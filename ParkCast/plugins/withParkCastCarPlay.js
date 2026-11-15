/**
 * Registers the CarPlay navigation scene, entitlement and runtime Info.plist keys.
 * The CarPlay scene itself lives in the local Expo module `modules/parkcast-native`.
 */
const { withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');

function readMirrorPort(config) {
  const port = Number(config.extra?.mirrorPort);
  return Number.isInteger(port) && port > 1024 && port < 65535 ? port : null;
}

function withParkCastCarPlay(config, options = {}) {
  const enableCarPlay =
    process.env.PARKCAST_ENABLE_CARPLAY_ENTITLEMENT !== 'false' &&
    options.enableCarPlayEntitlements !== false;
  const mirrorPort = readMirrorPort(config);

  config = withInfoPlist(config, (modConfig) => {
    const plist = modConfig.modResults;

    const modes = new Set(Array.isArray(plist.UIBackgroundModes) ? plist.UIBackgroundModes : []);
    ['audio', 'location'].forEach((mode) => modes.add(mode));
    plist.UIBackgroundModes = [...modes];

    plist.NSAppTransportSecurity = {
      NSAllowsArbitraryLoadsForMedia: true,
      NSAllowsArbitraryLoadsInWebContent: true,
      NSAllowsLocalNetworking: true,
    };

    if (mirrorPort) {
      plist.ParkCastMirrorPort = mirrorPort;
    }

    const sceneConfigurations = {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneClassName: 'UIWindowScene',
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: 'SceneDelegate',
        },
      ],
    };
    if (enableCarPlay) {
      sceneConfigurations.CPTemplateApplicationSceneSessionRoleApplication = [
        {
          UISceneClassName: 'CPTemplateApplicationScene',
          UISceneConfigurationName: 'ParkCastCarPlayScene',
          UISceneDelegateClassName: 'ParkCastCarPlaySceneDelegate',
        },
      ];
    }
    plist.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: sceneConfigurations,
    };

    delete plist.NSBonjourServices;
    return modConfig;
  });

  config = withEntitlementsPlist(config, (modConfig) => {
    if (enableCarPlay) {
      modConfig.modResults['com.apple.developer.carplay-maps'] = true;
    }
    return modConfig;
  });

  return config;
}

module.exports = withParkCastCarPlay;
module.exports.readMirrorPort = readMirrorPort;
