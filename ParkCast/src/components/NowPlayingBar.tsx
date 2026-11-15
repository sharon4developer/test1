import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCar } from '../context/CarContext';
import { IconButton } from '../ui/components';
import { colors, radius, shadow, space } from '../ui/theme';
import { formatClock } from '../lib/format';

const KIND_ICON = {
  video: 'film',
  photo: 'image',
  slideshow: 'images',
  web: 'globe',
} as const;

export const NowPlayingBar: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const { media, mode, playing, togglePlay, stop, seekBy, progress, mirroring, moving } = useCar();

  if (mode === 'mirror' && mirroring) {
    return (
      <View style={styles.bar}>
        <View style={[styles.art, { backgroundColor: colors.success }]}>
          <Ionicons name="phone-portrait" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mirroring to your car</Text>
          <Text style={styles.subtitle}>Stop from the red pill at the top of your iPhone</Text>
        </View>
      </View>
    );
  }

  if (!media || !['video', 'photo', 'slideshow', 'web'].includes(mode)) return null;
  const canSeek = media.kind === 'video' || media.kind === 'web';
  const subtitle = moving
    ? 'Paused while driving'
    : media.kind === 'video' && progress.duration > 0
      ? `${formatClock(progress.position)} / ${formatClock(progress.duration)}`
      : 'On your car screen';

  return (
    <View style={styles.bar}>
      <View style={styles.art}>
        <Ionicons name={KIND_ICON[media.kind]} size={20} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1} onPress={onOpen}>
          {media.title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {canSeek ? <IconButton icon="play-back" label="Back 10 seconds" size={38} onPress={() => seekBy(-10)} /> : null}
      {media.kind !== 'photo' ? (
        <IconButton
          icon={playing ? 'pause' : 'play'}
          label={playing ? 'Pause' : 'Play'}
          size={42}
          color={colors.white}
          background={colors.primary}
          onPress={togglePlay}
        />
      ) : null}
      {canSeek ? <IconButton icon="play-forward" label="Forward 10 seconds" size={38} onPress={() => seekBy(10)} /> : null}
      <IconButton icon="close" label="Stop" size={38} onPress={stop} />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    marginHorizontal: space(3),
    marginBottom: space(2),
    padding: space(2.5),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow.floating,
  },
  art: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
