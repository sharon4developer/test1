import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { BRAND, VideoQuality, AspectMode } from '../config/brand';
import { useSubscription } from '../context/SubscriptionContext';
import { useCastSession } from '../context/CastSessionContext';

interface PlayerRemoteScreenProps {
  onBackToDashboard: () => void;
}

const QUALITIES: VideoQuality[] = ['480p', '720p', '1080p', '4K'];
const ASPECTS: { id: AspectMode; label: string }[] = [
  { id: 'fit', label: 'Normal Fit' },
  { id: 'fill', label: 'Full Screen' },
  { id: 'cinema', label: 'Widescreen' },
];

export const PlayerRemoteScreen: React.FC<PlayerRemoteScreenProps> = ({
  onBackToDashboard,
}) => {
  const {
    isPro,
    openPaywall,
    canUseQuality,
    canUseAspectMode,
  } = useSubscription();

  const {
    roomCode,
    activeMedia,
    isPlaying,
    currentTimeSec,
    durationSec,
    volume,
    isMuted,
    quality,
    aspectMode,
    mirrorMode,
    mirrorWebUrl,
    togglePlayPause,
    seekBySeconds,
    setVolumeLevel,
    toggleMute,
    setQualityMode,
    setAspectRatioMode,
    setMirrorMode,
    setMirrorWebUrl,
    moveCursor,
    triggerRemoteCommand,
  } = useCastSession();

  const [mirrorUrlInput, setMirrorUrlInput] = useState(mirrorWebUrl || '');

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleQualityPress = (q: VideoQuality) => {
    if (!canUseQuality(q)) {
      openPaywall(`Upgrade to ParkCast Pro to watch in ${q} High Definition.`);
      return;
    }
    setQualityMode(q);
  };

  const handleAspectPress = (mode: AspectMode) => {
    if (!canUseAspectMode(mode)) {
      openPaywall('Upgrade to ParkCast Pro to expand videos to Full Screen and Widescreen.');
      return;
    }
    setAspectRatioMode(mode);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Clean Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="remote-back-btn"
          style={styles.backBtn}
          onPress={onBackToDashboard}
        >
          <Text style={styles.backBtnText}>← Home</Text>
        </TouchableOpacity>
        <View style={styles.connectedPill}>
          <View style={styles.greenDot} />
          <Text style={styles.connectedText}>Car Screen ({roomCode})</Text>
        </View>
      </View>

      {/* Main Player Card */}
      <View style={styles.playerCard}>
        <Text style={styles.nowPlayingTag}>
          {mirrorMode === 'screen_broadcast'
            ? 'MIRRORING TO CAR'
            : mirrorMode === 'photo_slideshow'
            ? 'SHOWING PHOTO ON CAR'
            : 'PLAYING ON CAR SCREEN'}
        </Text>
        <Text style={styles.mediaTitle}>
          {mirrorMode === 'screen_broadcast'
            ? 'Live iPhone Screen Mirror'
            : mirrorMode === 'photo_slideshow'
            ? 'iPhone Photo'
            : activeMedia.title}
        </Text>
        <Text style={styles.mediaSub}>{activeMedia.subtitle}</Text>

        {/* Simple Progress Bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  100,
                  Math.round((currentTimeSec / Math.max(1, durationSec)) * 100)
                )}%`,
              },
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTimeSec)}</Text>
          <Text style={styles.timeText}>{formatTime(durationSec)}</Text>
        </View>

        {/* Big Easy Playback Buttons */}
        <View style={styles.playbackRow}>
          <TouchableOpacity
            testID="remote-rewind-btn"
            style={styles.skipBtn}
            onPress={() => seekBySeconds(-15)}
          >
            <Text style={styles.skipBtnText}>⟲ 15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="remote-play-pause-btn"
            style={styles.bigPlayBtn}
            onPress={togglePlayPause}
          >
            <Text style={styles.bigPlayBtnText}>
              {isPlaying ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="remote-forward-btn"
            style={styles.skipBtn}
            onPress={() => seekBySeconds(15)}
          >
            <Text style={styles.skipBtnText}>15s ⟳</Text>
          </TouchableOpacity>
        </View>

        {/* Simple Volume Controls */}
        <View style={styles.volumeRow}>
          <TouchableOpacity style={styles.volBtn} onPress={toggleMute}>
            <Text style={styles.volBtnText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.volBtn}
            onPress={() => setVolumeLevel(volume - 10)}
          >
            <Text style={styles.volBtnText}>Quiet -</Text>
          </TouchableOpacity>
          <Text style={styles.volValueText}>
            Volume: {isMuted ? 'Muted' : `${volume}%`}
          </Text>
          <TouchableOpacity
            style={styles.volBtn}
            onPress={() => setVolumeLevel(volume + 10)}
          >
            <Text style={styles.volBtnText}>Louder +</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Size & Video Quality */}
      <View style={styles.settingCard}>
        <Text style={styles.settingTitle}>Car Screen Size</Text>
        <View style={styles.pillRow}>
          {ASPECTS.map((item) => {
            const unlocked = canUseAspectMode(item.id);
            const active = aspectMode === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                testID={`aspect-btn-${item.id}`}
                style={[styles.choicePill, active && styles.choicePillActive]}
                onPress={() => handleAspectPress(item.id)}
              >
                <Text
                  style={[
                    styles.choicePillText,
                    active && styles.choicePillTextActive,
                  ]}
                >
                  {item.label} {!unlocked ? '🔒' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.settingTitle, { marginTop: 14 }]}>Video Quality</Text>
        <View style={styles.pillRow}>
          {QUALITIES.map((q) => {
            const unlocked = canUseQuality(q);
            const active = quality === q;
            return (
              <TouchableOpacity
                key={q}
                testID={`quality-btn-${q}`}
                style={[styles.choicePill, active && styles.choicePillActive]}
                onPress={() => handleQualityPress(q)}
              >
                <Text
                  style={[
                    styles.choicePillText,
                    active && styles.choicePillTextActive,
                  ]}
                >
                  {q} {!unlocked ? '🔒' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Simple Car Screen Directional Pad */}
      <View style={styles.settingCard}>
        <Text style={styles.settingTitle}>Car Screen Pointer</Text>
        <Text style={styles.settingSub}>
          Move the pointer on your car screen and tap Select
        </Text>
        <View style={styles.dpadWrap}>
          <TouchableOpacity
            style={styles.dpadBtn}
            onPress={() => moveCursor(0, -10)}
          >
            <Text style={styles.dpadText}>▲ Up</Text>
          </TouchableOpacity>
          <View style={styles.dpadMiddleRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPress={() => moveCursor(-12, 0)}
            >
              <Text style={styles.dpadText}>◀ Left</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="remote-ok-select-btn"
              style={styles.dpadSelectBtn}
              onPress={() => triggerRemoteCommand('Select on Car Screen')}
            >
              <Text style={styles.dpadSelectText}>Select</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPress={() => moveCursor(12, 0)}
            >
              <Text style={styles.dpadText}>Right ▶</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.dpadBtn}
            onPress={() => moveCursor(0, 10)}
          >
            <Text style={styles.dpadText}>▼ Down</Text>
          </TouchableOpacity>
        </View>

        {mirrorMode === 'screen_broadcast' && (
          <View style={styles.mirrorBox}>
            <Text style={styles.settingTitle}>Quick Mirror Shortcuts</Text>
            <View style={styles.shortcutRow}>
              {[
                { label: 'Phone Home', url: null },
                { label: 'YouTube', url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U' },
                { label: 'Mazda 3 Info', url: 'https://en.m.wikipedia.org/wiki/Mazda3' },
              ].map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={styles.shortcutBtn}
                  onPress={() => setMirrorWebUrl(s.url)}
                >
                  <Text style={styles.shortcutBtnText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.urlRow}>
              <TextInput
                style={styles.urlInput}
                placeholder="Type any website or YouTube link..."
                placeholderTextColor="#94A3B8"
                value={mirrorUrlInput}
                onChangeText={setMirrorUrlInput}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.urlGoBtn}
                onPress={() => setMirrorWebUrl(mirrorUrlInput)}
              >
                <Text style={styles.urlGoBtnText}>Show</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mirrorMode !== 'off' && (
          <TouchableOpacity
            style={styles.stopMirrorBtn}
            onPress={() => setMirrorMode('off')}
          >
            <Text style={styles.stopMirrorText}>Back to Normal Video Player</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.colors.bgPrimary,
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  backBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  connectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  connectedText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  playerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  nowPlayingTag: {
    color: BRAND.colors.accentBlue,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  mediaTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 2,
  },
  mediaSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 13,
    marginBottom: 14,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: BRAND.colors.accentBlue,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeText: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  playbackRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  skipBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  skipBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  bigPlayBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 16,
  },
  bigPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  volBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  volBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  volValueText: {
    color: BRAND.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  settingTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  settingSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choicePill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  choicePillActive: {
    backgroundColor: '#DBEAFE',
    borderColor: BRAND.colors.accentBlue,
  },
  choicePillText: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  choicePillTextActive: {
    color: '#1D4ED8',
  },
  dpadWrap: {
    alignItems: 'center',
    gap: 8,
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dpadBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 96,
    alignItems: 'center',
  },
  dpadText: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  dpadSelectBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 20,
  },
  dpadSelectText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  mirrorBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  shortcutBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  shortcutBtnText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '700',
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    color: BRAND.colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  urlGoBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },
  urlGoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stopMirrorBtn: {
    marginTop: 12,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  stopMirrorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
});
