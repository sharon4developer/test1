import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { useSettings } from '../context/SettingsContext';
import { formatArrival, formatDistance, formatDuration } from '../lib/format';
import { colors, radius, space } from '../ui/theme';

function iconFor(instruction: string): React.ComponentProps<typeof Ionicons>['name'] {
  const text = instruction.toLowerCase();
  if (text.includes('arrive') || text.includes('destination')) return 'flag';
  if (text.includes('left')) return 'arrow-back';
  if (text.includes('right')) return 'arrow-forward';
  return 'arrow-up';
}

export const GuidanceBanner: React.FC = () => {
  const { guidance, endRoute } = useCar();
  const { settings } = useSettings();
  if (!guidance?.active) return null;
  const instruction = guidance.instruction ?? '';
  return (
    <View style={styles.banner}>
      <View style={styles.top}>
        <Ionicons name={iconFor(instruction)} size={34} color={colors.white} />
        <View style={{ flex: 1 }}>
          <Text style={styles.distance}>{formatDistance(guidance.distanceToManeuver ?? 0, settings.units)}</Text>
          <Text style={styles.instruction} numberOfLines={2}>
            {instruction}
          </Text>
        </View>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.eta}>
          {formatDuration(guidance.remainingTime ?? 0)} · {formatDistance(guidance.remainingDistance ?? 0, settings.units)} · Arrive{' '}
          {formatArrival(guidance.remainingTime ?? 0)}
        </Text>
        <Pressable onPress={endRoute} style={styles.end} accessibilityRole="button">
          <Text style={styles.endText}>End</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { backgroundColor: '#0B6B3A', borderRadius: radius.lg, padding: space(4), marginBottom: space(4), gap: space(3) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  distance: { color: colors.white, fontSize: 26, fontWeight: '800' },
  instruction: { color: '#DDF5E7', fontSize: 16, fontWeight: '600' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eta: { color: colors.white, fontSize: 14, fontWeight: '700', flex: 1 },
  end: { backgroundColor: colors.danger, paddingHorizontal: space(5), paddingVertical: space(2), borderRadius: radius.pill },
  endText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
