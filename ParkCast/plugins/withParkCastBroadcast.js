/**
 * Adds the `ParkCastBroadcast` ReplayKit broadcast upload extension target, so ParkCast shows up in the
 * iOS Screen Broadcast list and can mirror the whole iPhone screen to the CarPlay display.
 */
const fs = require('fs');
const path = require('path');
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');
const { readMirrorPort } = require('./withParkCastCarPlay');

const TARGET_NAME = 'ParkCastBroadcast';
const SOURCE_FILE = 'SampleHandler.swift';
const DEPLOYMENT_TARGET = '16.4';

function extensionBundleId(config) {
  return `${config.ios?.bundleIdentifier}.broadcast`;
}

function infoPlist(config) {
  const port = readMirrorPort(config);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>ParkCast</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
${port ? `  <key>ParkCastMirrorPort</key>\n  <integer>${port}</integer>\n` : ''}  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.broadcast-services-upload</string>
    <key>NSExtensionPrincipalClass</key>
    <string>${TARGET_NAME}.SampleHandler</string>
    <key>RPBroadcastProcessMode</key>
    <string>RPBroadcastProcessModeSampleBuffer</string>
  </dict>
</dict>
</plist>
`;
}

function withBroadcastFiles(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const targetDir = path.join(modConfig.modRequest.platformProjectRoot, TARGET_NAME);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'broadcast', SOURCE_FILE), path.join(targetDir, SOURCE_FILE));
      fs.writeFileSync(path.join(targetDir, 'Info.plist'), infoPlist(modConfig));
      return modConfig;
    },
  ]);
}

function withBroadcastTarget(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    if (project.pbxTargetByName(TARGET_NAME)) {
      return modConfig;
    }

    const objects = project.hash.project.objects;
    objects.PBXTargetDependency = objects.PBXTargetDependency || {};
    objects.PBXContainerItemProxy = objects.PBXContainerItemProxy || {};

    const bundleId = extensionBundleId(modConfig);
    const target = project.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, bundleId);

    const group = project.addPbxGroup([SOURCE_FILE, 'Info.plist'], TARGET_NAME, TARGET_NAME);
    const mainGroupId = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(group.uuid, mainGroupId);

    project.addBuildPhase([SOURCE_FILE], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    const version = modConfig.version || '1.0.0';
    const buildNumber = modConfig.ios?.buildNumber || '1';
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;
      if (entry.buildSettings.PRODUCT_NAME !== `"${TARGET_NAME}"`) continue;
      Object.assign(entry.buildSettings, {
        INFOPLIST_FILE: `${TARGET_NAME}/Info.plist`,
        PRODUCT_BUNDLE_IDENTIFIER: `"${bundleId}"`,
        IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
        TARGETED_DEVICE_FAMILY: '"1,2"',
        SWIFT_VERSION: '5.0',
        CLANG_ENABLE_MODULES: 'YES',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        GENERATE_INFOPLIST_FILE: 'NO',
        MARKETING_VERSION: version,
        CURRENT_PROJECT_VERSION: buildNumber,
        SKIP_INSTALL: 'YES',
      });
    }
    return modConfig;
  });
}

function withParkCastBroadcast(config) {
  if (!config.ios?.bundleIdentifier) {
    return config;
  }
  config = withBroadcastFiles(config);
  config = withBroadcastTarget(config);
  return config;
}

module.exports = withParkCastBroadcast;
module.exports.TARGET_NAME = TARGET_NAME;
