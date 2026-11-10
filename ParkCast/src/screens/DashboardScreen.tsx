import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BRAND, MEDIA_PRESETS, MediaPreset } from '../config/brand';
import { useSubscription } from '../context/SubscriptionContext';
import { useCastSession } from '../context/CastSessionContext';

interface DashboardScreenProps {
  onOpenRemote: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onOpenRemote }) => {
  const {
    isPro,
    planId,
    isTrialActive,
    remainingSessionSeconds,
    dailyLocalVideosUsed,
    maxDailyLocalVideos,
    openPaywall,
    downgradeToFreeForTesting,
    fastForwardFreeTimerForTesting,
  } = useSubscription();

  const {
    roomCode,
    connectionTarget,
    carName,
    relayConnected,
    relayHost,
    isParkedConfirmed,
    activeMedia,
    mirrorMode,
    customStreams,
    connectToCarReceiver,
    connectToAirPlay,
    disconnectCast,
    setParkedConfirmed,
    selectMedia,
    playCustomUrl,
    playYouTubeUrlOrQuery,
    castLocalPhotoOrVideo,
    setMirrorMode,
    recordLocalVideoCastFromSession,
  } = useCastSessionWithSub();

  const [pinInput, setPinInput] = useState(roomCode);
  const [relayHostInput, setRelayHostInput] = useState(relayHost);
  const [showPinEditor, setShowPinEditor] = useState(false);
  const [ytInput, setYtInput] = useState('');
  const [showYtModal, setShowYtModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [showIptvForm, setShowIptvForm] = useState(false);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSelectPreset = (preset: MediaPreset) => {
    if (preset.requiresPro && !isPro) {
      openPaywall(`"${preset.title}" is a Pro 1080p60 Live Channel. Upgrade to ParkCast Pro to unlock all live M3U8 feeds.`);
      return;
    }
    selectMedia(preset);
    onOpenRemote();
  };

  const handleStartScreenMirror = () => {
    if (!isPro) {
      openPaywall(
        'Real-Time Full iPhone Screen Mirroring is a ParkCast Pro feature. Upgrade to mirror any non-DRM app onto your car display.'
      );
      return;
    }
    setMirrorMode('screen_broadcast');
    onOpenRemote();
  };

  const handlePickCameraRoll = async (asVideo: boolean) => {
    if (asVideo && !recordLocalVideoCastFromSession()) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: asVideo ? ['videos'] : ['images'],
        quality: 0.7,
        base64: !asVideo,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await castLocalPhotoOrVideo(
          asset.uri,
          asset.fileName || (asVideo ? 'Camera Roll Video.mp4' : 'iPhone Photo'),
          asVideo,
          asset.base64 || undefined
        );
        onOpenRemote();
        return;
      }
    } catch {
      // Fallback to built-in sample camera roll media when running in headless browser or without photo permission
    }

    if (asVideo) {
      castLocalPhotoOrVideo(
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        'Roadtrip_Dashcam_Clip_HD.mp4',
        true
      );
    } else {
      castLocalPhotoOrVideo(
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
        'Alpine_Porsche_Stopover.jpg',
        false
      );
    }
    onOpenRemote();
  };

  const handleAddCustomStream = () => {
    if (!isPro && customStreams.length >= 1) {
      openPaywall(
        'The Free Starter plan includes 1 saved stream URL. Upgrade to ParkCast Pro for unlimited M3U8 / IPTV playlists and custom streams.'
      );
      return;
    }
    if (!customUrl.trim()) return;
    playCustomUrl(customTitle || 'Custom Car Stream', customUrl);
    setCustomTitle('');
    setCustomUrl('');
    setShowIptvForm(false);
    onOpenRemote();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Plan & Connection Header */}
      <View style={styles.headerRow}>
        <View>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>P</Text>
            </View>
            <Text style={styles.brandTitle}>{BRAND.appName}</Text>
            <View style={[styles.planBadge, isPro ? styles.planBadgePro : styles.planBadgeFree]}>
              <Text style={[styles.planBadgeText, isPro && styles.planBadgeTextPro]}>
                {isPro ? (isTrialActive ? 'PRO TRIAL' : 'PRO HD') : 'FREE PLAN'}
              </Text>
            </View>
          </View>
          <Text style={styles.brandSubtitle}>{BRAND.tagline}</Text>
        </View>

        <TouchableOpacity
          testID="header-upgrade-btn"
          style={[styles.upgradePill, isPro && styles.upgradePillPro]}
          onPress={() => openPaywall()}
        >
          <Text style={styles.upgradePillText}>
            {isPro ? 'Manage Pro' : `Upgrade · ${formatTimer(remainingSessionSeconds)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* STEP 1: Vehicle Connection Status Card */}
      <View style={styles.sectionCard}>
        <View style={styles.stepHeaderRow}>
          <Text style={styles.stepTag}>STEP 1 · VEHICLE LINK</Text>
          <View style={styles.statusDotRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    connectionTarget !== 'disconnected'
                      ? BRAND.colors.statusConnected
                      : BRAND.colors.statusWarning,
                },
              ]}
            />
            <Text style={styles.statusLabel}>
              {connectionTarget !== 'disconnected' ? carName : 'No Car Connected'}
            </Text>
          </View>
        </View>

        <View style={styles.connectButtonRow}>
          <TouchableOpacity
            testID="connect-car-pin-btn"
            style={[
              styles.connectModeBtn,
              connectionTarget === 'car_receiver' && styles.connectModeBtnActive,
            ]}
            onPress={() => setShowPinEditor(!showPinEditor)}
          >
            <Text style={styles.connectModeTitle}>Car Screen PIN: {roomCode}</Text>
            <Text style={styles.connectModeSub}>
              {relayConnected ? 'LAN Relay Live · Tap to change' : 'Instant Pair · Tap to edit PIN'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="connect-airplay-btn"
            style={[
              styles.connectModeBtn,
              connectionTarget === 'airplay' && styles.connectModeBtnActive,
            ]}
            onPress={connectToAirPlay}
          >
            <Text style={styles.connectModeTitle}>AirPlay Wireless</Text>
            <Text style={styles.connectModeSub}>Direct iOS Audio/Video Route</Text>
          </TouchableOpacity>
        </View>

        {showPinEditor && (
          <View style={styles.pinEditorBox}>
            <Text style={styles.pinHelpLabel}>
              Car Relay IP:Port (from `npm run relay` on your laptop) & 4-Digit PIN:
            </Text>
            <View style={styles.pinEditorRow}>
              <TextInput
                style={[styles.pinInput, { flex: 1.8 }]}
                value={relayHostInput}
                onChangeText={setRelayHostInput}
                placeholder="192.168.1.x:4848"
                placeholderTextColor={BRAND.colors.textMuted}
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.pinInput, { flex: 0.8 }]}
                value={pinInput}
                onChangeText={setPinInput}
                placeholder="PIN"
                placeholderTextColor={BRAND.colors.textMuted}
                maxLength={6}
              />
            </View>
            <View style={[styles.pinEditorRow, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[styles.pinApplyBtn, { flex: 1, alignItems: 'center' }]}
                onPress={() => {
                  connectToCarReceiver(pinInput, undefined, relayHostInput);
                  setShowPinEditor(false);
                }}
              >
                <Text style={styles.pinApplyText}>Connect & Pair Car Screen</Text>
              </TouchableOpacity>
              {connectionTarget !== 'disconnected' && (
                <TouchableOpacity style={styles.pinDisconnectBtn} onPress={disconnectCast}>
                  <Text style={styles.pinDisconnectText}>Disconnect</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Parked Safety Toggle */}
        <View style={styles.parkedSafetyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.parkedTitle}>Vehicle Parked Safety Confirmation</Text>
            <Text style={styles.parkedSub}>
              Video output is only enabled while your vehicle is safely parked.
            </Text>
          </View>
          <Switch
            testID="parked-safety-switch"
            value={isParkedConfirmed}
            onValueChange={setParkedConfirmed}
            trackColor={{ false: '#334155', true: '#059669' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Free Plan Usage Bar (only visible on Free Tier) */}
      {!isPro && (
        <View style={styles.freeUsageBanner}>
          <View style={styles.freeUsageTop}>
            <Text style={styles.freeUsageTitle}>
              Free Starter Plan · {formatTimer(remainingSessionSeconds)} session left
            </Text>
            <Text style={styles.freeUsageMeta}>
              Max 480p SD · {dailyLocalVideosUsed}/{maxDailyLocalVideos} Local Videos Today
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(
                    4,
                    Math.round((remainingSessionSeconds / BRAND.freeLimits.maxSessionSeconds) * 100)
                  )}%`,
                },
              ]}
            />
          </View>
          <View style={styles.freeBannerActions}>
            <TouchableOpacity
              testID="unlock-pro-banner-btn"
              style={styles.unlockProInlineBtn}
              onPress={() =>
                openPaywall('Unlock Unlimited 1080p/4K Streaming, Screen Mirroring & IPTV Playlists.')
              }
            >
              <Text style={styles.unlockProInlineText}>Unlock Pro 1080p/4K ($2.08/mo)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="simulate-timer-expiry-btn"
              style={styles.testTimerBtn}
              onPress={fastForwardFreeTimerForTesting}
            >
              <Text style={styles.testTimerBtnText}>Test 5s Left</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 2: 4 Large Automotive Source Cards */}
      <Text style={styles.sectionHeading}>STEP 2 · CHOOSE WHAT TO CAST</Text>
      <View style={styles.gridContainer}>
        {/* Card 1: YouTube & Web Video */}
        <TouchableOpacity
          testID="card-youtube-web"
          style={styles.sourceCard}
          onPress={() => setShowYtModal(!showYtModal)}
        >
          <View style={[styles.sourceIconWrap, { backgroundColor: '#1E3A8A' }]}>
            <Text style={styles.sourceIconText}>YT</Text>
          </View>
          <Text style={styles.sourceCardTitle}>YouTube & Web</Text>
          <Text style={styles.sourceCardSub}>
            Paste any YouTube link or stream to car receiver
          </Text>
          <View style={styles.cardBadgeRow}>
            <Text style={styles.cardBadgeText}>{isPro ? '1080p / 4K' : 'Tap to Cast YouTube'}</Text>
          </View>
        </TouchableOpacity>

        {/* Card 2: Mirror iPhone Screen */}
        <TouchableOpacity
          testID="card-screen-mirror"
          style={[
            styles.sourceCard,
            mirrorMode === 'screen_broadcast' && styles.sourceCardActive,
          ]}
          onPress={handleStartScreenMirror}
        >
          <View style={[styles.sourceIconWrap, { backgroundColor: '#4C1D95' }]}>
            <Text style={styles.sourceIconText}>iOS</Text>
          </View>
          <View style={styles.titleWithBadge}>
            <Text style={styles.sourceCardTitle}>Screen Mirror</Text>
            {!isPro && <Text style={styles.proMiniTag}>PRO</Text>}
          </View>
          <Text style={styles.sourceCardSub}>
            Live ReplayKit broadcast of your iPhone apps to car screen
          </Text>
          <View style={styles.cardBadgeRow}>
            <Text style={styles.cardBadgeText}>
              {isPro ? '60fps Live Broadcast' : 'Tap to Unlock Pro'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Card 3: Camera Roll Videos & Photos */}
        <View style={styles.sourceCard}>
          <View style={[styles.sourceIconWrap, { backgroundColor: '#065F46' }]}>
            <Text style={styles.sourceIconText}>HD</Text>
          </View>
          <Text style={styles.sourceCardTitle}>Phone Videos & Photos</Text>
          <Text style={styles.sourceCardSub}>
            Cast camera roll movies & trip photo albums
          </Text>
          <View style={styles.dualActionRow}>
            <TouchableOpacity
              testID="pick-local-video-btn"
              style={styles.miniActionBtn}
              onPress={() => handlePickCameraRoll(true)}
            >
              <Text style={styles.miniActionText}>Cast Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="pick-local-photo-btn"
              style={[styles.miniActionBtn, styles.miniActionBtnSecondary]}
              onPress={() => handlePickCameraRoll(false)}
            >
              <Text style={styles.miniActionText}>Cast Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Card 4: IPTV & Custom Stream URL */}
        <TouchableOpacity
          testID="card-iptv-streams"
          style={styles.sourceCard}
          onPress={() => setShowIptvForm(!showIptvForm)}
        >
          <View style={[styles.sourceIconWrap, { backgroundColor: '#7C2D12' }]}>
            <Text style={styles.sourceIconText}>TV</Text>
          </View>
          <View style={styles.titleWithBadge}>
            <Text style={styles.sourceCardTitle}>IPTV & M3U8 URL</Text>
            {!isPro && <Text style={styles.proMiniTag}>1 FREE</Text>}
          </View>
          <Text style={styles.sourceCardSub}>
            Play direct HLS .m3u8 live channels or .mp4 links
          </Text>
          <View style={styles.cardBadgeRow}>
            <Text style={styles.cardBadgeText}>Add Stream Link</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Expandable YouTube URL / Video ID Launcher */}
      {showYtModal && (
        <View style={styles.iptvFormCard}>
          <Text style={styles.iptvFormTitle}>Cast Any YouTube Video to Car Screen</Text>
          <TextInput
            style={styles.iptvInput}
            placeholder="Paste YouTube URL (e.g. https://youtu.be/ysz5S6PUM-U)"
            placeholderTextColor={BRAND.colors.textMuted}
            value={ytInput}
            onChangeText={setYtInput}
            autoCapitalize="none"
          />
          <View style={styles.iptvBtnRow}>
            <TouchableOpacity
              style={[styles.iptvCastBtn, { marginRight: 8, backgroundColor: '#334155' }]}
              onPress={() => {
                selectMedia(MEDIA_PRESETS[0]);
                setShowYtModal(false);
                onOpenRemote();
              }}
            >
              <Text style={styles.iptvCastBtnText}>Play 4K Demo Drive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iptvCastBtn}
              onPress={() => {
                playYouTubeUrlOrQuery(ytInput || 'https://youtu.be/ysz5S6PUM-U');
                setYtInput('');
                setShowYtModal(false);
                onOpenRemote();
              }}
            >
              <Text style={styles.iptvCastBtnText}>Cast YouTube to Car</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Expandable Custom Stream / IPTV URL Form */}
      {showIptvForm && (
        <View style={styles.iptvFormCard}>
          <Text style={styles.iptvFormTitle}>Cast Direct Video / HLS (.m3u8 / .mp4) URL</Text>
          <TextInput
            style={styles.iptvInput}
            placeholder="Channel or Movie Title (e.g. Live Sports HD)"
            placeholderTextColor={BRAND.colors.textMuted}
            value={customTitle}
            onChangeText={setCustomTitle}
          />
          <TextInput
            style={styles.iptvInput}
            placeholder="https://example.com/stream.m3u8 or video.mp4"
            placeholderTextColor={BRAND.colors.textMuted}
            value={customUrl}
            onChangeText={setCustomUrl}
            autoCapitalize="none"
          />
          <View style={styles.iptvBtnRow}>
            <TouchableOpacity style={styles.iptvCastBtn} onPress={handleAddCustomStream}>
              <Text style={styles.iptvCastBtnText}>Beam to Car Display</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 3: Ready-to-Cast Cinema & Live Channels */}
      <View style={styles.step3HeaderRow}>
        <Text style={styles.sectionHeading}>STEP 3 · INSTANT CAR CINEMA CHANNELS</Text>
        <TouchableOpacity testID="open-remote-btn" onPress={onOpenRemote}>
          <Text style={styles.openRemoteLink}>Open Touchpad Remote →</Text>
        </TouchableOpacity>
      </View>

      {MEDIA_PRESETS.map((item) => {
        const isCurrent = activeMedia.id === item.id && mirrorMode === 'off';
        return (
          <TouchableOpacity
            key={item.id}
            testID={`preset-${item.id}`}
            style={[styles.presetRow, isCurrent && styles.presetRowActive]}
            onPress={() => handleSelectPreset(item)}
          >
            <View style={[styles.presetThumb, { backgroundColor: item.thumbnailColor }]}>
              <Text style={styles.presetThumbBadge}>{item.durationLabel}</Text>
            </View>
            <View style={styles.presetInfo}>
              <View style={styles.presetTitleRow}>
                <Text style={styles.presetTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.requiresPro && !isPro && (
                  <View style={styles.proLockPill}>
                    <Text style={styles.proLockPillText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.presetSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
            <View style={[styles.castActionPill, isCurrent && styles.castActionPillActive]}>
              <Text style={styles.castActionText}>{isCurrent ? 'CASTING' : 'CAST'}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Expo Go Developer Sandbox Bar for testing Free vs Paid transitions */}
      <View style={styles.devSandboxCard}>
        <Text style={styles.devSandboxTitle}>Expo Go Subscription Sandbox Controls</Text>
        <Text style={styles.devSandboxSub}>
          Current Active Tier: <Text style={{ color: '#38BDF8', fontWeight: '700' }}>{planId.toUpperCase()}</Text> · In production builds, RevenueCat + Apple StoreKit 2 manages this automatically.
        </Text>
        <View style={styles.devSandboxBtnRow}>
          <TouchableOpacity
            style={styles.devBtn}
            onPress={() => openPaywall('Previewing the ParkCast Pro Paywall')}
          >
            <Text style={styles.devBtnText}>Open Paywall</Text>
          </TouchableOpacity>
          {isPro && (
            <TouchableOpacity
              testID="reset-to-free-btn"
              style={styles.devBtn}
              onPress={downgradeToFreeForTesting}
            >
              <Text style={styles.devBtnText}>Switch Back to Free Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

function useCastSessionWithSub() {
  const cast = useCastSession();
  const { recordLocalVideoCast } = useSubscription();
  return {
    ...cast,
    recordLocalVideoCastFromSession: recordLocalVideoCast,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.colors.bgPrimary,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: BRAND.colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  brandTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  planBadgeFree: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  planBadgePro: {
    backgroundColor: '#F59E0B22',
    borderWidth: 1,
    borderColor: BRAND.colors.accentGold,
  },
  planBadgeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
  },
  planBadgeTextPro: {
    color: BRAND.colors.accentGold,
  },
  upgradePill: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  upgradePillPro: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: BRAND.colors.accentGold,
  },
  upgradePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: BRAND.colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    marginBottom: 14,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepTag: {
    color: BRAND.colors.accentCyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: BRAND.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  connectButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  connectModeBtn: {
    flex: 1,
    backgroundColor: BRAND.colors.bgSecondary,
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  connectModeBtnActive: {
    borderColor: BRAND.colors.accentBlue,
    backgroundColor: '#1E3A8A33',
  },
  connectModeTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  connectModeSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  pinEditorBox: {
    marginTop: 10,
    backgroundColor: BRAND.colors.bgSecondary,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  pinHelpLabel: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    marginBottom: 6,
  },
  pinEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinInput: {
    flex: 1,
    backgroundColor: BRAND.colors.bgPrimary,
    color: BRAND.colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    fontSize: 14,
    fontWeight: '700',
  },
  pinApplyBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  pinApplyText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pinDisconnectBtn: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  pinDisconnectText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  parkedSafetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  parkedTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  parkedSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  freeUsageBanner: {
    backgroundColor: '#172554',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    marginBottom: 14,
  },
  freeUsageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  freeUsageTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  freeUsageMeta: {
    color: '#93C5FD',
    fontSize: 11,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
  },
  freeBannerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  unlockProInlineBtn: {
    flex: 1,
    backgroundColor: BRAND.colors.accentGold,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  unlockProInlineText: {
    color: '#080C14',
    fontSize: 12,
    fontWeight: '800',
  },
  testTimerBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  testTimerBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeading: {
    color: BRAND.colors.accentCyan,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  sourceCard: {
    width: '48%',
    backgroundColor: BRAND.colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
    justifyContent: 'space-between',
  },
  sourceCardActive: {
    borderColor: BRAND.colors.accentPurple,
    backgroundColor: '#2E106544',
  },
  sourceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sourceIconText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceCardTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  proMiniTag: {
    backgroundColor: BRAND.colors.accentGold,
    color: '#080C14',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceCardSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
  },
  cardBadgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.colors.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniActionBtn: {
    flex: 1,
    backgroundColor: BRAND.colors.accentBlue,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  miniActionBtnSecondary: {
    backgroundColor: '#334155',
  },
  miniActionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  iptvFormCard: {
    backgroundColor: BRAND.colors.bgCardElevated,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BRAND.colors.accentBlue,
  },
  iptvFormTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  iptvInput: {
    backgroundColor: BRAND.colors.bgPrimary,
    color: BRAND.colors.textPrimary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  iptvBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  iptvCastBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  iptvCastBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  step3HeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openRemoteLink: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.colors.bgCard,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  presetRowActive: {
    borderColor: BRAND.colors.statusConnected,
    backgroundColor: '#064E3B33',
  },
  presetThumb: {
    width: 66,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  presetThumbBadge: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  presetInfo: {
    flex: 1,
    marginRight: 8,
  },
  presetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  proLockPill: {
    backgroundColor: BRAND.colors.accentGold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proLockPillText: {
    color: '#080C14',
    fontSize: 9,
    fontWeight: '800',
  },
  presetSubtitle: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  castActionPill: {
    backgroundColor: BRAND.colors.bgSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  castActionPillActive: {
    backgroundColor: BRAND.colors.statusConnected,
    borderColor: BRAND.colors.statusConnected,
  },
  castActionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  devSandboxCard: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  devSandboxTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  devSandboxSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  devSandboxBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  devBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  devBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
});
