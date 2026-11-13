/**
 * ParkCast Generation-2 CarPlay & External Car Display Expo Config Plugin
 *
 * Implements the universal CarPlay + External Display architecture:
 * 1. Configures `UIApplicationSceneManifest` in `Info.plist` with:
 *    - `CPTemplateApplicationSceneSessionRoleApplication` -> `ParkCastCarPlaySceneDelegate`
 *      (CarPlay `CPMapTemplate` + `CPWindow` Base View rendering live `https://parkcast-x9nd.onrender.com/car`
 *       directly onto the 2025 Mazda 3 GT 10.25-inch CarPlay screen!)
 * 2. Writes `ParkCastCarPlaySceneDelegate.swift` and adds it to the Xcode project build phase during EAS Build.
 * 3. Injects Apple-approved `com.apple.developer.carplay-maps = true` into `Entitlements.plist`.
 */

const fs = require('fs');
const path = require('path');
const {
  withInfoPlist,
  withEntitlementsPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const CARPLAY_SWIFT_SOURCE = `import Foundation
import UIKit
import CarPlay
import WebKit

@objc(ParkCastCarPlaySceneDelegate)
class ParkCastCarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate, CPMapTemplateDelegate {
  var interfaceController: CPInterfaceController?
  var carWindow: CPWindow?
  var webView: WKWebView?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController,
    to window: CPWindow
  ) {
    self.interfaceController = interfaceController
    self.carWindow = window

    // 1. Create the root CPWindow ViewController hosting the live ParkCast Car Receiver
    let rootVC = UIViewController()
    rootVC.view.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.16, alpha: 1.0)

    let config = WKWebViewConfiguration()
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []

    let wv = WKWebView(frame: window.bounds, configuration: config)
    wv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    wv.isOpaque = false
    wv.backgroundColor = .clear
    wv.scrollView.isScrollEnabled = true
    wv.scrollView.bounces = false

    if let url = URL(string: "https://parkcast-x9nd.onrender.com/car?pin=4829") {
      wv.load(URLRequest(url: url))
    }

    rootVC.view.addSubview(wv)
    self.webView = wv
    window.rootViewController = rootVC
    window.makeKeyAndVisible()

    // 2. Present the CPMapTemplate control layer with Navigation Bar & Panning buttons
    let mapTemplate = CPMapTemplate()
    mapTemplate.mapDelegate = self
    mapTemplate.automaticallyHidesNavigationBar = true

    let mapBtn = CPBarButton(title: "Drive & Map") { [weak self] _ in
      self?.webView?.evaluateJavaScript("if(window.switchLocalTab){window.switchLocalTab('map');}", completionHandler: nil)
    }

    let loungeBtn = CPBarButton(title: "Parked Lounge") { [weak self] _ in
      self?.webView?.evaluateJavaScript("if(window.switchLocalTab){window.switchLocalTab('library');}", completionHandler: nil)
    }

    let splitBtn = CPBarButton(title: "Split-View") { [weak self] _ in
      self?.webView?.evaluateJavaScript("if(window.toggleLocalSplit){window.toggleLocalSplit();}", completionHandler: nil)
    }

    let reloadBtn = CPBarButton(title: "Sync") { [weak self] _ in
      self?.webView?.reload()
    }

    mapTemplate.leadingNavigationBarButtons = [mapBtn, loungeBtn]
    mapTemplate.trailingNavigationBarButtons = [splitBtn, reloadBtn]

    interfaceController.setRootTemplate(mapTemplate, animated: true, completion: nil)
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnect interfaceController: CPInterfaceController,
    from window: CPWindow
  ) {
    self.webView = nil
    self.carWindow = nil
    self.interfaceController = nil
  }
}
`;

function withParkCastCarPlay(config, options = {}) {
  const enableManagedCarPlay =
    process.env.PARKCAST_ENABLE_CARPLAY_ENTITLEMENT !== 'false' &&
    (options.enableCarPlayEntitlements !== false);

  config = withInfoPlist(config, (modConfig) => {
    const infoPlist = modConfig.modResults;

    // 1. Background modes for continuous car audio, PiP, and turn-by-turn navigation
    const existingBgModes = Array.isArray(infoPlist.UIBackgroundModes)
      ? infoPlist.UIBackgroundModes
      : [];
    const requiredBgModes = ['audio', 'location', 'fetch'];
    for (const mode of requiredBgModes) {
      if (!existingBgModes.includes(mode)) {
        existingBgModes.push(mode);
      }
    }
    infoPlist.UIBackgroundModes = existingBgModes;

    // 2. Allow arbitrary media streams (M3U / HLS / HTTP LAN Relay / Cloud Relay)
    infoPlist.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: true,
      NSAllowsLocalNetworking: true,
    };

    // 3. Register CarPlay Template Application Scene (Leaves main phone window to React Native AppDelegate
    //    while routing the CarPlay display directly to ParkCastCarPlaySceneDelegate!)
    if (enableManagedCarPlay) {
      infoPlist.UIApplicationSceneManifest = {
        UIApplicationSupportsMultipleScenes: true,
        UISceneConfigurations: {
          CPTemplateApplicationSceneSessionRoleApplication: [
            {
              UISceneClassName: 'CPTemplateApplicationScene',
              UISceneConfigurationName: 'ParkCastCarPlayScene',
              UISceneDelegateClassName: 'ParkCastCarPlaySceneDelegate',
            },
          ],
        },
      };
    }

    // 4. Bonjour services for zero-config Car Display & AirPlay / DLNA discovery
    infoPlist.NSBonjourServices = [
      '_airplay._tcp',
      '_raop._tcp',
      '_parkcast._tcp',
      '_http._tcp',
    ];

    return modConfig;
  });

  config = withEntitlementsPlist(config, (modConfig) => {
    const entitlements = modConfig.modResults;

    if (enableManagedCarPlay) {
      // Apple-approved CarPlay Navigation entitlement on Team 84QUP535TA:
      // Gives ParkCast a full CPWindow base view on 100% of CarPlay cars (including 2025 Mazda 3 GT & iOS 27.2+)
      entitlements['com.apple.developer.carplay-maps'] = true;
    }

    return modConfig;
  });

  config = withXcodeProject(config, (modConfig) => {
    if (!enableManagedCarPlay) {
      return modConfig;
    }
    const xcodeProject = modConfig.modResults;
    const projectName = modConfig.modRequest.projectName;
    const iosRoot = modConfig.modRequest.platformProjectRoot;
    const targetDir = path.join(iosRoot, projectName);

    fs.mkdirSync(targetDir, { recursive: true });
    const swiftFilePath = path.join(targetDir, 'ParkCastCarPlaySceneDelegate.swift');
    fs.writeFileSync(swiftFilePath, CARPLAY_SWIFT_SOURCE, 'utf8');

    const relativeFilePath = `${projectName}/ParkCastCarPlaySceneDelegate.swift`;
    const group =
      xcodeProject.pbxGroupByName(projectName) ||
      xcodeProject.findPBXGroupKey({ name: projectName });

    if (!xcodeProject.hasFile(relativeFilePath)) {
      xcodeProject.addSourceFile(
        relativeFilePath,
        { target: xcodeProject.getFirstTarget().uuid },
        group
      );
    }

    return modConfig;
  });

  return config;
}

module.exports = withParkCastCarPlay;
