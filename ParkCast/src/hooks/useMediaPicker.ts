import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCar } from '../context/CarContext';
import { useSubscription } from '../context/SubscriptionContext';
import { formatClock } from '../lib/format';

const FREE_MEMORIES_LIMIT = 10;

async function ensurePermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!requested.granted) {
    Alert.alert('Photos access is off', 'Allow ParkCast to see your photos in iPhone Settings › ParkCast › Photos.');
  }
  return requested.granted;
}

export function useMediaPicker() {
  const { play } = useCar();
  const { isPro, openPaywall } = useSubscription();

  const pickAndPlay = useCallback(async () => {
    if (!(await ensurePermission())) return false;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
      videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return false;
    if (asset.type === 'video') {
      return play({
        kind: 'video',
        uri: asset.uri,
        title: asset.fileName ?? 'Video from your iPhone',
        subtitle: asset.duration ? `Video · ${formatClock(asset.duration / 1000)}` : 'Video',
      });
    }
    return play({ kind: 'photo', uri: asset.uri, title: asset.fileName ?? 'Photo from your iPhone', subtitle: 'Photo' });
  }, [play]);

  const pickMemories = useCallback(async () => {
    if (!(await ensurePermission())) return false;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: isPro ? 100 : FREE_MEMORIES_LIMIT,
      orderedSelection: true,
      quality: 1,
    });
    if (result.canceled || !result.assets.length) return false;
    const items = result.assets.map((asset) => asset.uri);
    if (!isPro && result.assets.length >= FREE_MEMORIES_LIMIT) {
      openPaywall(`Free slideshows hold up to ${FREE_MEMORIES_LIMIT} photos. Premium has no limit.`);
    }
    return play({
      kind: 'slideshow',
      uri: items[0],
      items,
      title: `Memories · ${items.length} photos`,
      subtitle: 'Slideshow',
    });
  }, [isPro, openPaywall, play]);

  return { pickAndPlay, pickMemories };
}
