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
const ASPECTS: { id: AspectMode; label: string; pro?: boolean }[] = [
  { id: 'fit', label: 'Standard Fit' },
  { id: 'fill', label: 'Full-Bleed Fill', pro: true },
  { id: 'cinema', label: 'Cinema 21:9 Zoom', pro: true },
];

export const PlayerRemoteScreen: React.FC<PlayerRemoteScreenProps> = ({
  onBackToDashboard,
}) => {
  const {
    isPro,
    remainingSessionSeconds,
    openPaywall,
    canUseQuality,
    canUseAspectMode,
  } = useSubscription();

  const {
    carName,
    roomCode,
    activeMedia,
    isPlaying,
    currentTimeSec,
    durationSec,
    volume,
    isMuted,
    quality,
    aspectMode,
    steeringSide,
    mirrorMode,
    mirrorWebUrl,
    cursorPos,
    lastRemoteAction,
    togglePlayPause,
    seekBySeconds,
    setVolumeLevel,
    toggleMute,
    setQualityMode,
    setAspectRatioMode,
    setSteeringSide,
    setMirrorMode,
    setMirrorWebUrl,
    moveCursor,
    triggerRemoteCommand,
    openActiveMediaOnPhoneForAirPlay,
  } = useCastSession();

  const [mirrorUrlInput, setMirrorUrlInput] = useState(mirrorWebUrl || '');

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleQualityPress = (q: VideoQuality) => {
    if (!canUseQuality(q)) {
      openPaywall(
        `${q} High-Definition Car Streaming requires ParkCast Pro. Free Starter plan streams at 480p SD.`
      );
      return;
    }
    setQualityMode(q);
  };

  const handleAspectPress = (mode: AspectMode) => {
    if (!canUseAspectMode(mode)) {
      openPaywall(
        `Full-Bleed Fill and Cinema 21:9 Zoom require ParkCast Pro so you can eliminate black bars on wide car displays.`
      );
      return;
    }
    setAspectRatioMode(mode);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          testID="remote-back-btn"
          style={styles.backBtn}
          onPress={onBackToDashboard}
        >
          <Text style={styles.backBtnText}>← Sources</Text>
        </TouchableOpacity>
        <View style={styles.targetPill}>
          <View style={styles.liveDot} />
          <Text style={styles.targetPillText}>
            {carName} (PIN {roomCode})
          </Text>
        </View>
      </View>

      {/* Now Casting Card */}
      <View style={styles.nowPlayingCard}>
        <View style={styles.nowPlayingHeader}>
          <Text style={styles.nowPlayingBadge}>
            {mirrorMode === 'screen_broadcast'
              ? 'LIVE IPHONE SCREEN MIRROR'
              : mirrorMode === 'photo_slideshow'
              ? 'IPHONE PHOTO CAST'
              : `NOW CASTING · ${quality}`}
          </Text>
          {!isPro && (
            <TouchableOpacity onPress={() => openPaywall()}>
              <Text style={styles.freeTimerWarning}>
                Free Timer: {formatTime(remainingSessionSeconds)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.mediaTitle}>
          {mirrorMode === 'screen_broadcast'
            ? 'iPhone Home Screen & Apps Broadcast'
            : activeMedia.title}
        </Text>
        <Text style={styles.mediaSubtitle}>{activeMedia.subtitle}</Text>

        <TouchableOpacity
          style={styles.airplayLaunchBtn}
          onPress={openActiveMediaOnPhoneForAirPlay}
        >
          <Text style={styles.airplayLaunchBtnText}>
            ▶ Open Native iPhone Player / AirPlay to Car Audio & Screen
          </Text>
        </TouchableOpacity>

        {/* Scrubber Bar */}
        <View style={styles.scrubberSection}>
          <View style={styles.scrubberTrack}>
            <View
              style={[
                styles.scrubberFill,
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
            <Text style={styles.lastActionText} numberOfLines={1}>
              {lastRemoteAction}
            </Text>
            <Text style={styles.timeText}>
              {activeMedia.isLive ? 'LIVE' : formatTime(durationSec)}
            </Text>
          </View>
        </View>

        {/* Transport Controls */}
        <View style={styles.transportRow}>
          <TouchableOpacity
            testID="remote-rewind-btn"
            style={styles.secondaryTransportBtn}
            onPress={() => seekBySeconds(-15)}
          >
            <Text style={styles.secondaryTransportText}>-15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="remote-play-pause-btn"
            style={styles.primaryPlayBtn}
            onPress={togglePlayPause}
          >
            <Text style={styles.primaryPlayText}>{isPlaying ? 'PAUSE' : 'PLAY'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="remote-forward-btn"
            style={styles.secondaryTransportBtn}
            onPress={() => seekBySeconds(15)}
          >
            <Text style={styles.secondaryTransportText}>+15s</Text>
          </TouchableOpacity>
        </View>

        {/* Volume Bar */}
        <View style={styles.volumeRow}>
          <TouchableOpacity style={styles.muteBtn} onPress={toggleMute}>
            <Text style={styles.muteBtnText}>{isMuted ? 'UNMUTE' : 'MUTE'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.volStepBtn}
            onPress={() => setVolumeLevel(volume - 10)}
          >
            <Text style={styles.volStepText}>Vol -</Text>
          </TouchableOpacity>
          <View style={styles.volBarWrap}>
            <View style={styles.volTrack}>
              <View
                style={[
                  styles.volFill,
                  { width: `${isMuted ? 0 : volume}%` },
                ]}
              />
            </View>
            <Text style={styles.volLabel}>
              Car Audio: {isMuted ? 'Muted' : `${volume}%`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.volStepBtn}
            onPress={() => setVolumeLevel(volume + 10)}
          >
            <Text style={styles.volStepText}>Vol +</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stream Resolution Selector (Free 480p vs Pro 1080p/4K) */}
      <View style={styles.controlCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardSectionTitle}>STREAM QUALITY</Text>
          <Text style={styles.cardSectionHint}>
            {isPro ? 'Pro HD/4K Unlocked' : '480p Free · 1080p/4K Pro'}
          </Text>
        </View>
        <View style={styles.pillRow}>
          {QUALITIES.map((q) => {
            const unlocked = canUseQuality(q);
            const active = quality === q;
            return (
              <TouchableOpacity
                key={q}
                testID={`quality-btn-${q}`}
                style={[
                  styles.optionPill,
                  active && styles.optionPillActive,
                ]}
                onPress={() => handleQualityPress(q)}
              >
                <Text
                  style={[
                    styles.optionPillText,
                    active && styles.optionPillTextActive,
                  ]}
                >
                  {q} {!unlocked ? '🔒' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Car Screen Aspect Ratio & Driver Dock Side */}
      <View style={styles.controlCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardSectionTitle}>CAR DISPLAY SCALING & DOCK</Text>
          <TouchableOpacity
            onPress={() =>
              setSteeringSide(steeringSide === 'left' ? 'right' : 'left')
            }
          >
            <Text style={styles.dockToggleLink}>
              Driver Dock: {steeringSide.toUpperCase()} ⇄
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.pillRow}>
          {ASPECTS.map((item) => {
            const unlocked = canUseAspectMode(item.id);
            const active = aspectMode === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                testID={`aspect-btn-${item.id}`}
                style={[
                  styles.optionPill,
                  active && styles.optionPillActive,
                ]}
                onPress={() => handleAspectPress(item.id)}
              >
                <Text
                  style={[
                    styles.optionPillText,
                    active && styles.optionPillTextActive,
                  ]}
                >
                  {item.label} {!unlocked ? '🔒' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Interactive Car Touchpad & Rotary Knob Controller */}
      <View style={styles.touchpadCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardSectionTitle}>CAR SCREEN TOUCHPAD & ROTARY REMOTE</Text>
          <Text style={styles.cardSectionHint}>
            Cursor ({cursorPos.x}%, {cursorPos.y}%)
          </Text>
        </View>
        <Text style={styles.touchpadDesc}>
          Control web menus and video overlays on non-touch CarPlay displays right from your iPhone.
        </Text>

        <View style={styles.dpadGrid}>
          <TouchableOpacity
            style={styles.dpadBtn}
            onPress={() => moveCursor(0, -10)}
          >
            <Text style={styles.dpadBtnText}>▲ Up</Text>
          </TouchableOpacity>
          <View style={styles.dpadMidRow}>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPress={() => moveCursor(-12, 0)}
            >
              <Text style={styles.dpadBtnText}>◀ Left</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="remote-ok-select-btn"
              style={styles.dpadCenterBtn}
              onPress={() => triggerRemoteCommand('Click / Select on Car Screen')}
            >
              <Text style={styles.dpadCenterText}>OK / TAP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dpadBtn}
              onPress={() => moveCursor(12, 0)}
            >
              <Text style={styles.dpadBtnText}>Right ▶</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.dpadBtn}
            onPress={() => moveCursor(0, 10)}
          >
            <Text style={styles.dpadBtnText}>▼ Down</Text>
          </TouchableOpacity>
        </View>

        {mirrorMode === 'screen_broadcast' && (
          <View style={styles.mirrorControlBox}>
            <Text style={styles.cardSectionTitle}>
              LIVE MIRROR LAUNCHER (BEAMS TO CAR SCREEN)
            </Text>
            <Text style={styles.touchpadDesc}>
              Tap an app or enter any URL / YouTube link to mirror it live onto your Car Screen Receiver:
            </Text>
            <View style={styles.mirrorAppShortcutRow}>
              {[
                { label: 'iPhone Home', url: null },
                { label: 'YouTube 4K', url: 'https://www.youtube.com/watch?v=ysz5S6PUM-U' },
                { label: 'Wikipedia', url: 'https://en.m.wikipedia.org/wiki/Mazda3' },
                { label: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html' },
              ].map((shortcut) => (
                <TouchableOpacity
                  key={shortcut.label}
                  style={styles.mirrorShortcutChip}
                  onPress={() => setMirrorWebUrl(shortcut.url)}
                >
                  <Text style={styles.mirrorShortcutText}>{shortcut.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.mirrorUrlRow}>
              <TextInput
                style={styles.mirrorUrlInput}
                placeholder="Paste URL or YouTube link to mirror..."
                placeholderTextColor={BRAND.colors.textMuted}
                value={mirrorUrlInput}
                onChangeText={setMirrorUrlInput}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.mirrorUrlGoBtn}
                onPress={() => setMirrorWebUrl(mirrorUrlInput)}
              >
                <Text style={styles.mirrorUrlGoText}>Mirror</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mirrorMode !== 'off' && (
          <TouchableOpacity
            style={styles.stopMirrorBtn}
            onPress={() => setMirrorMode('off')}
          >
            <Text style={styles.stopMirrorBtnText}>
              Exit Mirror Mode & Return to Video Player
            </Text>
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
    padding: 16,
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    backgroundColor: BRAND.colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  backBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  targetPillText: {
    color: '#ECFDF5',
    fontSize: 12,
    fontWeight: '700',
  },
  nowPlayingCard: {
    backgroundColor: BRAND.colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    marginBottom: 14,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nowPlayingBadge: {
    color: BRAND.colors.accentCyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  freeTimerWarning: {
    color: BRAND.colors.accentGold,
    fontSize: 11,
    fontWeight: '700',
  },
  mediaTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  mediaSubtitle: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
  },
  airplayLaunchBtn: {
    backgroundColor: '#1E3A8A',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  airplayLaunchBtnText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  scrubberSection: {
    marginBottom: 16,
  },
  scrubberTrack: {
    height: 7,
    backgroundColor: BRAND.colors.bgPrimary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: BRAND.colors.accentBlue,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  lastActionText: {
    color: '#38BDF8',
    fontSize: 11,
    maxWidth: '60%',
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 16,
  },
  secondaryTransportBtn: {
    backgroundColor: BRAND.colors.bgSecondary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  secondaryTransportText: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryPlayBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryPlayText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  muteBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  muteBtnText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '800',
  },
  volStepBtn: {
    backgroundColor: BRAND.colors.bgSecondary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  volStepText: {
    color: BRAND.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  volBarWrap: {
    flex: 1,
  },
  volTrack: {
    height: 6,
    backgroundColor: BRAND.colors.bgPrimary,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  volFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  volLabel: {
    color: BRAND.colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
  controlCard: {
    backgroundColor: BRAND.colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardSectionTitle: {
    color: BRAND.colors.accentCyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  cardSectionHint: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
  },
  dockToggleLink: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    flex: 1,
    minWidth: 70,
    backgroundColor: BRAND.colors.bgSecondary,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  optionPillActive: {
    backgroundColor: '#1E3A8A',
    borderColor: BRAND.colors.accentBlue,
  },
  optionPillText: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  optionPillTextActive: {
    color: '#FFFFFF',
  },
  touchpadCard: {
    backgroundColor: BRAND.colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  touchpadDesc: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    marginBottom: 12,
  },
  dpadGrid: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  dpadMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dpadBtn: {
    backgroundColor: BRAND.colors.bgSecondary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    minWidth: 96,
    alignItems: 'center',
  },
  dpadBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  dpadCenterBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
  },
  dpadCenterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stopMirrorBtn: {
    marginTop: 12,
    backgroundColor: '#7F1D1D',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  stopMirrorBtnText: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '700',
  },
  mirrorControlBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  mirrorAppShortcutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  mirrorShortcutChip: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  mirrorShortcutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  mirrorUrlRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  mirrorUrlInput: {
    flex: 1,
    backgroundColor: BRAND.colors.bgPrimary,
    color: BRAND.colors.textPrimary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  mirrorUrlGoBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  mirrorUrlGoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
