import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { useSettings } from '../context/SettingsContext';
import { useSubscription } from '../context/SubscriptionContext';
import { ParkCastNative } from '../native/ParkCastNative';
import { showRewardedAd } from '../ads/ads';
import { FREE_LIMIT_REACHED } from '../config/brand';
import { Card, ScreenTitle, Segmented, tap } from '../ui/components';
import { colors, space, text } from '../ui/theme';

const STEPS = [
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

  const start = async () => {
    if (!nativeAvailable) {
      Alert.alert('Mirroring needs the iPhone app', 'Install ParkCast from TestFlight to mirror to your car.');
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
    }
    tap();
    ParkCastNative.showBroadcastPicker().catch(() => {});
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
        {!isPro && freeMinutes !== null ? (
          <Text style={text.caption}>{freeMinutes} free minutes left today</Text>
        ) : null}
      </View>

      <Text style={[text.sectionLabel, styles.label]}>Quality</Text>
      <Segmented
        value={isPro ? settings.mirrorQuality : 'standard'}
        options={[
          { value: 'standard', label: 'Standard' },
          { value: 'hd', label: 'HD 60 fps', locked: !isPro },
        ]}
        onChange={(value) => {
          if (value === 'hd' && !isPro) {
            openPaywall('HD 60 fps mirroring is part of Premium.');
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

const styles = StyleSheet.create({
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
