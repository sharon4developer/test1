import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { useMediaPicker } from '../hooks/useMediaPicker';
import { BRAND } from '../config/brand';
import { Button, type IconName } from '../ui/components';
import { colors, radius, space, text } from '../ui/theme';

const appIcon = require('../../assets/icon.png');

interface Step {
  icon: IconName;
  color: string;
  title: string;
  body: string;
  action: string;
}

const STEPS: Step[] = [
  {
    icon: 'car-sport',
    color: colors.primary,
    title: 'Plug in, open ParkCast on CarPlay',
    body: 'Connect your iPhone to the car by cable or wireless CarPlay, then tap the ParkCast icon on the car screen. Everything you start on the phone appears there.',
    action: 'Next',
  },
  {
    icon: 'location',
    color: colors.success,
    title: 'Directions and park detection',
    body: 'ParkCast uses your location for turn-by-turn directions, local weather and to pause video automatically while the car is moving.',
    action: 'Allow location',
  },
  {
    icon: 'images',
    color: colors.warning,
    title: 'Try it with a photo',
    body: 'Pick any photo or video and watch it appear on the car screen. You can also mirror your whole phone or open any website.',
    action: 'Choose a photo',
  },
];

export const OnboardingScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { requestLocation } = useCar();
  const { pickAndPlay } = useMediaPicker();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const next = async () => {
    if (index === 1) await requestLocation();
    if (last) {
      await pickAndPlay().catch(() => false);
      onDone();
      return;
    }
    setIndex(index + 1);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Image source={appIcon} style={styles.logo} />
        <Text style={styles.brand}>{BRAND.appName}</Text>
      </View>

      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: step.color }]}>
          <Ionicons name={step.icon} size={56} color={colors.white} />
        </View>
        <Text style={[text.hero, styles.center]}>{step.title}</Text>
        <Text style={[styles.copy, styles.center]}>{step.body}</Text>
      </View>

      <View style={styles.dots}>
        {STEPS.map((item, dot) => (
          <View key={item.title} style={[styles.dot, dot === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Button title={step.action} size="lg" onPress={next} />
        <Button title={last ? 'Skip for now' : 'Skip'} variant="ghost" onPress={last ? onDone : () => setIndex(index + 1)} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(6) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingTop: space(4) },
  logo: { width: 32, height: 32, borderRadius: 8 },
  brand: { fontSize: 18, fontWeight: '800', color: colors.text },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space(5) },
  iconCircle: { width: 120, height: 120, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  copy: { fontSize: 17, lineHeight: 25, color: colors.textSecondary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space(2), marginBottom: space(6) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.primary },
  footer: { gap: space(2), paddingBottom: space(4) },
});
