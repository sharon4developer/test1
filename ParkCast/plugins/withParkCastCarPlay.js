/**
 * ParkCast Generation-2 CarPlay & External Car Display Expo Config Plugin
 *
 * Implements the universal CarPlay + External Display architecture:
 * 1. Configures `UIApplicationSceneManifest` in `Info.plist` with:
 *    - `UIWindowSceneSessionRoleApplication` (iPhone Controller)
 *    - `UIWindowSceneSessionRoleExternalDisplayNonInteractive` (Direct Secondary Car/HDMI/AirPlay Window)
 *    - `CPTemplateApplicationSceneSessionRoleApplication` (CarPlay `CPMapTemplate` + `CPWindow` Base View)
 * 2. Configures background audio, picture-in-picture, and AirPlay routing so audio/video
 *    auto-resumes after phone calls and works across iOS 18 – iOS 27.2+.
 * 3. When `PARKCAST_ENABLE_CARPLAY_ENTITLEMENT=true` is set (once Apple enables CarPlay on Team 84QUP535TA),
 *    injects `com.apple.developer.carplay-maps`, `com.apple.developer.carplay-audio`, and
 *    `com.apple.developer.carplay-video` into `Entitlements.plist`.
 */

const { withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');

function withParkCastCarPlay(config, options = {}) {
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

    // 2. Allow arbitrary media streams (M3U / HLS / HTTP LAN Relay / Jellyfin / Xtream)
    infoPlist.NSAppTransportSecurity = {
      NSAllowsArbitraryLoads: true,
      NSAllowsLocalNetworking: true,
    };

    // 3. Register Multi-Screen Scene Manifest (iPhone + External Car Display + CarPlay Base View)
    infoPlist.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneClassName: 'UIWindowScene',
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
        UIWindowSceneSessionRoleExternalDisplayNonInteractive: [
          {
            UISceneClassName: 'UIWindowScene',
            UISceneConfigurationName: 'ParkCastExternalCarDisplay',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
        CPTemplateApplicationSceneSessionRoleApplication: [
          {
            UISceneClassName: 'CPTemplateApplicationScene',
            UISceneConfigurationName: 'ParkCastCarPlayScene',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };

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
    const enableManagedCarPlay =
      process.env.PARKCAST_ENABLE_CARPLAY_ENTITLEMENT === 'true' ||
      Boolean(options && options.enableCarPlayEntitlements);

    if (enableManagedCarPlay) {
      // Universal CarPlay Navigation Base View (works in ALL CarPlay cars, even on iOS 27.2+)
      entitlements['com.apple.developer.carplay-maps'] = true;
      // CarPlay Audio & Video entitlements
      entitlements['com.apple.developer.carplay-audio'] = true;
      entitlements['com.apple.developer.carplay-video'] = true;
    }

    return modConfig;
  });

  return config;
}

module.exports = withParkCastCarPlay;
