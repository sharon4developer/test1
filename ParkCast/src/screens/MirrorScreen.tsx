import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { useSettings } from '../context/SettingsContext';
import { useSubscription } from '../context/SubscriptionContext';
import { NATIVE_UNAVAILABLE_TEXT, nativeUnavailableReason, ParkCastNative, type NativeDiagnostics } from '../native/ParkCastNative';
import { showRewardedAd } from '../ads/ads';
import { FREE_LIMIT_REACHED } from '../config/brand';
import { Card, ScreenTitle, Segmented, tap } from '../ui/components';
import { colors, space, text } from '../ui/theme';

const STEPS = [
  'Open ParkCast on the car screen first.',
  'Tap Start mirroring, then choose ParkCast and Start Broadcast.',
  'Open any app — YouTube, Netflix, Photos — and it shows on the car.',
  'Turn your iPhone sideways for widescreen video.',
  'To stop, tap the red pill at the top of your iPhone.',
];

export const MirrorScreen: React.FC = () => {
  const { nativeAvailable, mirroring, carConnected, moving } = useCar();
  const { settings, update } = useSettings();
  const { isPro, freeSecondsLeft, openPaywall } = useSubscription();
  const [starting, setStarting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const checkSetup = useCallback(() => setHint(mirrorProblem(ParkCastNative.getDiagnostics(), carConnected)), [carConnected]);

  useEffect(() => {
    checkSetup();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && checkSetup());
    return () => subscription.remove();
  }, [checkSetup, mirroring]);

  const start = async () => {
    if (!nativeAvailable) {
      const reason = NATIVE_UNAVAILABLE_TEXT[nativeUnavailableReason ?? 'missingFromBuild'];
      Alert.alert(reason.title, reason.detail);
      return;
    }
    if (!isPro && !mirroring) {
      if (freeSecondsLeft <= 0) {
        openPaywall(`${FREE_LIMIT_REACHED} Go Premium for unlimited mirroring.`);
        return;
      }
      setStarting(true);
      const allowed = await showRewardedAd();
      setStarting(false);
      if (!allowed) {
        Alert.alert('Mirroring not started', 'Watch the short video to mirror for free, or go Premium for no ads.');
        return;
      }
      // The ad screen has to finish closing before iOS will present the broadcast sheet.
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    tap();
    ParkCastNative.logEvent(`mirror tapped (car ${carConnected ? 'connected' : 'not connected'})`);
    ParkCastNative.showBroadcastPicker().catch(() => {});
    setTimeout(checkSetup, 10000);
  };

  const freeMinutes = Number.isFinite(freeSecondsLeft) ? Math.ceil(freeSecondsLeft / 60) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenTitle title="Mirror" subtitle="Show your whole iPhone screen on the car" />

      <View style={styles.hero}>
        <Pressable
          testID="mirror-start"
          onPress={start}
          disabled={starting}
          style={({ pressed }) => [
            styles.bigButton,
            { backgroundColor: mirroring ? colors.success : colors.primary, opacity: pressed || starting ? 0.85 : 1 },
          ]}
        >
          <Ionicons name={mirroring ? 'radio' : 'phone-portrait'} size={56} color={colors.white} />
          <Text style={styles.bigButtonText}>{mirroring ? 'Mirroring' : starting ? 'One moment…' : 'Start mirroring'}</Text>
        </Pressable>
        <Text style={styles.status}>
          {mirroring
            ? moving
              ? 'Paused on the car while driving'
              : 'Your iPhone is on the car screen'
            : carConnected
              ? 'Car connected and ready'
              : 'Connect CarPlay, then open ParkCast on the car'}
        </Text>
        {hint ? (
          <View style={styles.hint}>
            <Ionicons name="information-circle" size={20} color={colors.warning} />
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ) : null}
        {!isPro && freeMinutes !== null ? (
          <Text style={text.caption}>{freeMinutes} free minutes left today</Text>
        ) : null}
      </View>

      <Text style={[text.sectionLabel, styles.label]}>Quality</Text>
      <Segmented<'basic' | 'standard' | 'hd'>
        value={isPro ? settings.mirrorQuality : 'basic'}
        options={[
          ...(isPro ? [] : [{ value: 'basic' as const, label: 'Basic 480p' }]),
          { value: 'standard', label: isPro ? 'Standard' : 'Full HD', locked: !isPro },
          { value: 'hd', label: 'HD 60 fps', locked: !isPro },
        ]}
        onChange={(value) => {
          if (value === 'basic') return;
          if (!isPro) {
            openPaywall('Sharp, smooth mirroring is part of Premium. Free mirroring is 480p.');
            return;
          }
          update({ mirrorQuality: value });
        }}
      />

      <Text style={[text.sectionLabel, styles.label]}>How it works</Text>
      <Card>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </Card>
      <Text style={[text.caption, { marginTop: space(3), lineHeight: 17 }]}>
        For passengers and parked use. The car screen pauses automatically while the car is moving.
      </Text>
    </ScrollView>
  );
};

function mirrorProblem(info: NativeDiagnostics | null, carConnected: boolean): string | null {
  if (!info) return null;
  if (!info.broadcastExtensionInstalled) return 'This build is missing the ParkCast screen broadcast extension, so mirroring cannot start. Install the latest build.';
  if (!info.mirrorPort) return 'This build has no mirror port configured. Install the latest build.';
  if (!info.mirrorListening) return 'ParkCast is still getting ready to receive your screen. Wait a moment and try again.';
  if (!carConnected) return 'Open ParkCast on the car screen first, then start mirroring here.';
  return null;
}

const styles = StyleSheet.create({
  hint: {
    flexDirection: 'row',
    gap: space(2),
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: 14,
    padding: space(3),
    marginHorizontal: space(2),
  },
  hintText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19 },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(5), paddingBottom: space(10) },
  hero: { alignItems: 'center', gap: space(3), marginVertical: space(4) },
  bigButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  bigButtonText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  status: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  label: { marginTop: space(6), marginBottom: space(2) },
  step: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start', paddingVertical: space(2) },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: colors.primary, fontWeight: '800' },
  stepText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
});
