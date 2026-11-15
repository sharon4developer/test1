import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Platform, Share } from 'react-native';
import Constants from 'expo-constants';
import {
  isNativeAvailable,
  NATIVE_UNAVAILABLE_TEXT,
  nativeUnavailableReason,
  ParkCastNative,
  type NativeDiagnostics,
} from '../native/ParkCastNative';
import { useCar } from '../context/CarContext';
import { ListRow, Section } from '../ui/components';
import { colors } from '../ui/theme';

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

export function diagnosticsReport(info: NativeDiagnostics | null, log: string): string {
  const header = [
    `ParkCast diagnostics, ${new Date().toISOString()}`,
    `Runtime: ${String(Constants.executionEnvironment)} on ${Platform.OS} ${String(Platform.Version)}`,
    `Native module: ${isNativeAvailable ? 'loaded' : `NOT loaded (${nativeUnavailableReason})`}`,
  ];
  if (info) {
    header.push(
      `App: ${info.appVersion} (${info.buildNumber}) ${info.bundleId}`,
      `iOS: ${info.iosVersion}`,
      `CarPlay scene declared: ${yesNo(info.carPlaySceneDeclared)}, connected: ${yesNo(info.carConnected)}`,
      `Mirror port: ${info.mirrorPort || 'none'}, listening: ${yesNo(info.mirrorListening)}, active: ${yesNo(info.mirrorActive)}, frames: ${info.mirrorFramesReceived}`,
      `Broadcast extension installed: ${yesNo(info.broadcastExtensionInstalled)}`,
      `Location: ${info.location}, has fix: ${yesNo(info.hasLocationFix)}`
    );
  }
  return `${header.join('\n')}\n\n--- Event log ---\n${log || '(empty)'}`;
}

export const DiagnosticsSection: React.FC = () => {
  const { carConnected, mirroring } = useCar();
  const [info, setInfo] = useState<NativeDiagnostics | null>(() => ParkCastNative.getDiagnostics());

  const refresh = useCallback(() => setInfo(ParkCastNative.getDiagnostics()), []);

  useEffect(refresh, [refresh, carConnected, mirroring]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, [refresh]);

  const share = () => {
    Share.share({ message: diagnosticsReport(ParkCastNative.getDiagnostics(), ParkCastNative.getDiagnosticsLog()) }).catch(() => {});
  };

  const clear = () =>
    Alert.alert('Clear the diagnostics log?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => ParkCastNative.clearDiagnosticsLog() },
    ]);

  const ok = (value: boolean) => (value ? colors.success : colors.danger);

  if (!info) {
    const reason = NATIVE_UNAVAILABLE_TEXT[nativeUnavailableReason ?? 'missingFromBuild'];
    return (
      <Section title="Diagnostics" footer={reason.detail}>
        <ListRow icon="alert-circle" iconColor={colors.danger} title="Native module" value="Not loaded" subtitle={reason.title} />
        <ListRow icon="share-outline" title="Share diagnostics" onPress={share} chevron last />
      </Section>
    );
  }

  return (
    <Section
      title="Diagnostics"
      footer="If something doesn't work in the car, reproduce it, then share this log with support. It contains no passwords or locations."
    >
      <ListRow icon="checkmark-circle" iconColor={colors.success} title="Native module" value="Loaded" />
      <ListRow icon="information-circle-outline" title="Build" value={`${info.appVersion} (${info.buildNumber})`} />
      <ListRow
        icon="car-sport-outline"
        iconColor={ok(info.carPlaySceneDeclared)}
        title="CarPlay"
        value={!info.carPlaySceneDeclared ? 'Not in this build' : info.carConnected ? 'Connected' : 'Not connected'}
      />
      <ListRow
        icon="phone-portrait-outline"
        iconColor={ok(info.broadcastExtensionInstalled && info.mirrorListening)}
        title="Mirroring"
        subtitle={`Extension ${info.broadcastExtensionInstalled ? 'installed' : 'missing'} · port ${info.mirrorPort || 'none'} ${info.mirrorListening ? 'listening' : 'closed'}`}
        value={info.mirrorActive ? `${info.mirrorFramesReceived} frames` : 'Idle'}
      />
      <ListRow
        icon="location-outline"
        iconColor={ok(info.location === 'whenInUse' || info.location === 'always')}
        title="Location"
        value={info.hasLocationFix ? 'Located' : info.location}
      />
      <ListRow icon="share-outline" title="Share diagnostics log" onPress={share} chevron />
      <ListRow icon="trash-outline" title="Clear log" onPress={clear} destructive last />
    </Section>
  );
};
