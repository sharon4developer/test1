import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { colors, radius, space } from '../ui/theme';
import { NATIVE_UNAVAILABLE_TEXT, nativeUnavailableReason, type CarMode } from '../native/ParkCastNative';

const MODE_LABEL: Record<CarMode, string> = {
  home: 'Showing the clock',
  map: 'Showing the map',
  video: 'Playing a video',
  photo: 'Showing a photo',
  slideshow: 'Playing your Memories',
  web: 'Playing from the web',
  mirror: 'Mirroring your iPhone',
};

export const CarStatusCard: React.FC = () => {
  const { nativeAvailable, carConnected, mode, media, moving, weatherText } = useCar();

  let icon: React.ComponentProps<typeof Ionicons>['name'] = 'car-sport-outline';
  let tone = colors.textSecondary;
  let title = 'Connect to CarPlay';
  let detail = 'Plug in your iPhone or connect wirelessly, then tap ParkCast on the car screen.';

  if (!nativeAvailable && nativeUnavailableReason) {
    icon = 'alert-circle-outline';
    tone = colors.warning;
    ({ title, detail } = NATIVE_UNAVAILABLE_TEXT[nativeUnavailableReason]);
  } else if (carConnected) {
    icon = 'car-sport';
    tone = colors.success;
    title = 'Car connected';
    detail = media && mode !== 'home' && mode !== 'map' ? `${MODE_LABEL[mode]} · ${media.title}` : MODE_LABEL[mode];
    if (moving) {
      tone = colors.warning;
      detail = 'Driving — video pauses until you park';
    }
  }

  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: `${tone}1F` }]}>
        <Ionicons name={icon} size={24} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: carConnected || !nativeAvailable ? tone : colors.text }]}>{title}</Text>
        <Text style={styles.detail} numberOfLines={3}>
          {detail}
        </Text>
      </View>
      {weatherText ? <Text style={styles.weather}>{weatherText.split(' ')[0]}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  detail: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  weather: { fontSize: 18, fontWeight: '700', color: colors.text },
});
