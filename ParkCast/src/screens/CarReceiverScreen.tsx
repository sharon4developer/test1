import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { BRAND } from '../config/brand';
import { useSubscription } from '../context/SubscriptionContext';
import { useCastSession } from '../context/CastSessionContext';

export const CarReceiverScreen: React.FC = () => {
  const {
    isPro,
    remainingSessionSeconds,
    isSessionExpired,
    openPaywall,
    resetFreeSessionTimer,
  } = useSubscription();

  const {
    roomCode,
    connectionTarget,
    isParkedConfirmed,
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
    selectedPhotoUri,
    cursorPos,
    lastRemoteAction,
    togglePlayPause,
    seekBySeconds,
    setAspectRatioMode,
    setParkedConfirmed,
  } = useCastSession();

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getVideoResizeMode = (): ResizeMode => {
    if (aspectMode === 'fill' || aspectMode === 'cinema') {
      return ResizeMode.COVER;
    }
    return ResizeMode.CONTAIN;
  };

  const dockColumn = (
    <View style={styles.carPlayDock}>
      <View style={styles.dockTopGroup}>
        <Text style={styles.dockClock}>12:45</Text>
        <View style={styles.dockSignalRow}>
          <Text style={styles.dockSignalText}>5G</Text>
          <Text style={styles.dockWifiText}>Wi-Fi</Text>
        </View>
      </View>

      <View style={styles.dockAppStack}>
        <View style={[styles.dockAppIcon, { backgroundColor: BRAND.colors.accentBlue }]}>
          <Text style={styles.dockAppIconLabel}>P</Text>
        </View>
        <View style={[styles.dockAppIcon, { backgroundColor: '#10B981' }]}>
          <Text style={styles.dockAppIconLabel}>NAV</Text>
        </View>
        <View style={[styles.dockAppIcon, { backgroundColor: '#F43F5E' }]}>
          <Text style={styles.dockAppIconLabel}>MUS</Text>
        </View>
      </View>

      <View style={styles.dockHomeCircle}>
        <View style={styles.dockHomeInnerSquare} />
      </View>
    </View>
  );

  return (
    <View style={styles.outerFrame}>
      {/* Head-Unit Top Bezel Label */}
      <View style={styles.bezelTopBar}>
        <View style={styles.bezelLeft}>
          <View
            style={[
              styles.bezelDot,
              {
                backgroundColor:
                  connectionTarget !== 'disconnected' ? '#10B981' : '#F59E0B',
              },
            ]}
          />
          <Text style={styles.bezelTitle}>
            CAR HEAD-UNIT DISPLAY · PIN {roomCode}
          </Text>
        </View>
        <View style={styles.bezelBadges}>
          <View style={styles.bezelBadge}>
            <Text style={styles.bezelBadgeText}>{quality}</Text>
          </View>
          <View style={styles.bezelBadge}>
            <Text style={styles.bezelBadgeText}>{aspectMode.toUpperCase()}</Text>
          </View>
          <View
            style={[
              styles.bezelBadge,
              isPro ? styles.bezelBadgePro : styles.bezelBadgeFree,
            ]}
          >
            <Text
              style={[
                styles.bezelBadgeText,
                isPro && { color: BRAND.colors.accentGold },
              ]}
            >
              {isPro ? 'PRO UNLIMITED' : `FREE ${formatTime(remainingSessionSeconds)}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Main CarPlay Screen Surface */}
      <View
        style={[
          styles.carScreenBody,
          steeringSide === 'right' && { flexDirection: 'row-reverse' },
        ]}
      >
        {dockColumn}

        {/* Video / Mirror Stage */}
        <View style={styles.stageArea}>
          {connectionTarget === 'disconnected' ? (
            <View style={styles.overlayCentered}>
              <Text style={styles.standbyPinLabel}>PAIRING PIN: {roomCode}</Text>
              <Text style={styles.standbyTitle}>Waiting for iPhone ParkCast Connection</Text>
              <Text style={styles.standbySub}>
                Open ParkCast in Expo Go on your iPhone and enter PIN {roomCode} or choose AirPlay.
              </Text>
            </View>
          ) : !isParkedConfirmed ? (
            <View style={styles.overlayCentered}>
              <View style={styles.safetyBadge}>
                <Text style={styles.safetyBadgeText}>SAFETY INTERLOCK ACTIVE</Text>
              </View>
              <Text style={styles.standbyTitle}>
                Video Hidden While Vehicle Is Moving
              </Text>
              <Text style={styles.standbySub}>
                Audio continues through car speakers. Shift into Park to view video on the dashboard display.
              </Text>
              <TouchableOpacity
                style={styles.confirmParkedBtn}
                onPress={() => setParkedConfirmed(true)}
              >
                <Text style={styles.confirmParkedBtnText}>
                  Vehicle Is Parked · Resume Video
                </Text>
              </TouchableOpacity>
            </View>
          ) : isSessionExpired ? (
            <View style={styles.overlayCentered}>
              <View style={styles.expiredBadge}>
                <Text style={styles.expiredBadgeText}>FREE 15-MIN SESSION ENDED</Text>
              </View>
              <Text style={styles.standbyTitle}>
                Upgrade to ParkCast Pro for Non-Stop Car Cinema
              </Text>
              <Text style={styles.standbySub}>
                Unlock unlimited session length, 1080p/4K resolution, full iPhone screen mirroring, and custom M3U8 channels.
              </Text>
              <View style={styles.expiredBtnRow}>
                <TouchableOpacity
                  style={styles.upgradeFromCarBtn}
                  onPress={() =>
                    openPaywall(
                      'Unlock Unlimited Car Cinema Streaming with ParkCast Pro.'
                    )
                  }
                >
                  <Text style={styles.upgradeFromCarBtnText}>
                    Unlock ParkCast Pro on iPhone
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resetFreeDemoBtn}
                  onPress={resetFreeSessionTimer}
                >
                  <Text style={styles.resetFreeDemoText}>Reset 15m Demo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : mirrorMode === 'screen_broadcast' ? (
            /* Live iPhone Screen Mirroring Broadcast View */
            <View style={styles.mirrorContainer}>
              <View style={styles.mirrorPhoneMock}>
                <View style={styles.mirrorPhoneStatus}>
                  <Text style={styles.mirrorPhoneTime}>12:45 · ReplayKit Live</Text>
                  <Text style={styles.mirrorPhoneRec}>● REC CAST</Text>
                </View>
                <Text style={styles.mirrorPhoneHeading}>
                  iPhone Live Screen Mirroring (60fps)
                </Text>
                <View style={styles.mirrorAppGrid}>
                  {[
                    { name: 'YouTube', color: '#DC2626' },
                    { name: 'Safari Web', color: '#2563EB' },
                    { name: 'Photos HD', color: '#059669' },
                    { name: 'Files / VLC', color: '#EA580C' },
                    { name: 'Spotify', color: '#16A34A' },
                    { name: 'Maps Live', color: '#4F46E5' },
                  ].map((app) => (
                    <View
                      key={app.name}
                      style={[styles.mirrorAppTile, { backgroundColor: app.color }]}
                    >
                      <Text style={styles.mirrorAppTileText}>{app.name}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.mirrorDrmFootnote}>
                  Non-DRM apps mirror in full HD with car audio.
                </Text>
              </View>
            </View>
          ) : mirrorMode === 'photo_slideshow' && selectedPhotoUri ? (
            /* Camera Roll Photo Cast View */
            <View style={styles.photoStage}>
              <Image
                source={{ uri: selectedPhotoUri }}
                style={styles.castedPhoto}
                resizeMode="contain"
              />
              <View style={styles.photoCaptionPill}>
                <Text style={styles.photoCaptionText}>
                  iPhone Camera Roll Photo Cast · {quality}
                </Text>
              </View>
            </View>
          ) : (
            /* Video Stream Stage (Live Automotive Cinema Visualizer + HTML5/Expo-AV Video) */
            <View
              style={[
                styles.videoViewport,
                aspectMode === 'cinema' && { transform: [{ scale: 1.08 }] },
              ]}
            >
              {/* Built-in Rich Cinema Stage Backdrop so playback is always vivid even offline */}
              <View
                style={[
                  styles.cinemaVisualizerStage,
                  { backgroundColor: activeMedia.thumbnailColor },
                  aspectMode === 'fit' && styles.cinemaVisualizerFit,
                ]}
              >
                <View style={styles.cinemaSkyGlow} />
                <View style={styles.cinemaMountainRow}>
                  <View style={styles.cinemaPeakLeft} />
                  <View style={styles.cinemaPeakCenter} />
                  <View style={styles.cinemaPeakRight} />
                </View>
                <View style={styles.cinemaRoadDeck}>
                  <View style={styles.cinemaHorizonLine} />
                  <View style={styles.cinemaCenterPlayingCard}>
                    <View style={styles.cinemaLiveBadgeRow}>
                      <View
                        style={[
                          styles.cinemaLivePulseDot,
                          !isPlaying && { backgroundColor: '#F59E0B' },
                        ]}
                      />
                      <Text style={styles.cinemaLiveBadgeText}>
                        {isPlaying
                          ? `PLAYING ON CAR SCREEN · ${quality} HD`
                          : 'PAUSED ON CAR SCREEN'}
                      </Text>
                    </View>
                    <Text style={styles.cinemaStageMainTitle}>
                      {activeMedia.title}
                    </Text>
                    <Text style={styles.cinemaStageSub}>
                      {activeMedia.subtitle} · Aspect: {aspectMode.toUpperCase()}
                    </Text>

                    {/* Animated Progress / Audio Wave Bars */}
                    <View style={styles.waveBarContainer}>
                      {[28, 46, 36, 58, 42, 64, 50, 32, 54, 40, 60, 34].map(
                        (baseH, idx) => {
                          const dynamicH = isPlaying
                            ? ((baseH + (currentTimeSec * 9 + idx * 7)) % 44) + 16
                            : 14;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.waveBar,
                                {
                                  height: dynamicH,
                                  backgroundColor:
                                    idx % 2 === 0 ? '#38BDF8' : '#34D399',
                                },
                              ]}
                            />
                          );
                        }
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {Platform.OS !== 'web' && (
                <Video
                  source={{ uri: activeMedia.streamUrl }}
                  shouldPlay={isPlaying}
                  isMuted={isMuted}
                  isLooping={true}
                  resizeMode={getVideoResizeMode()}
                  style={styles.nativeVideo}
                />
              )}

              {/* Top HUD */}
              <View
                pointerEvents="none"
                style={[
                  styles.videoTopGradientHud,
                  { borderLeftColor: '#38BDF8' },
                ]}
              >
                <View>
                  <Text style={styles.hudChannelCategory}>
                    {activeMedia.category.toUpperCase()} STREAM · {quality} ·{' '}
                    {aspectMode.toUpperCase()}
                  </Text>
                  <Text style={styles.hudVideoTitle}>{activeMedia.title}</Text>
                </View>
                <View style={styles.hudAudioBadge}>
                  <Text style={styles.hudAudioText}>
                    {isMuted ? 'MUTED' : `VOL ${volume}%`}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* On-Screen Touchpad Cursor (Controlled by iPhone Remote) */}
          {connectionTarget !== 'disconnected' && isParkedConfirmed && (
            <View
              pointerEvents="none"
              style={[
                styles.remoteCursor,
                {
                  left: `${cursorPos.x}%`,
                  top: `${cursorPos.y}%`,
                },
              ]}
            >
              <View style={styles.remoteCursorInner} />
              <Text style={styles.remoteCursorTag}>REMOTE</Text>
            </View>
          )}

          {/* Car Screen Bottom Transport Overlay Bar */}
          {connectionTarget !== 'disconnected' && isParkedConfirmed && !isSessionExpired && (
            <View style={styles.carBottomBar}>
              <View style={styles.carTransportLeft}>
                <TouchableOpacity
                  style={styles.carBarBtn}
                  onPress={() => seekBySeconds(-15)}
                >
                  <Text style={styles.carBarBtnText}>⟲ 15s</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.carBarBtn, styles.carBarPlayBtn]}
                  onPress={togglePlayPause}
                >
                  <Text style={styles.carBarPlayText}>
                    {isPlaying ? '❚❚ Pause' : '▶ Play'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.carBarBtn}
                  onPress={() => seekBySeconds(15)}
                >
                  <Text style={styles.carBarBtnText}>15s ⟳</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.carTimelineMid}>
                <Text style={styles.carTimelineStatus} numberOfLines={1}>
                  {lastRemoteAction}
                </Text>
                <Text style={styles.carTimecode}>
                  {formatTime(currentTimeSec)} /{' '}
                  {activeMedia.isLive ? 'LIVE' : formatTime(durationSec)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.carAspectBtn}
                onPress={() =>
                  setAspectRatioMode(
                    aspectMode === 'fit'
                      ? 'fill'
                      : aspectMode === 'fill'
                      ? 'cinema'
                      : 'fit'
                  )
                }
              >
                <Text style={styles.carAspectBtnText}>
                  Ratio: {aspectMode.toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerFrame: {
    flex: 1,
    backgroundColor: '#05080F',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    overflow: 'hidden',
    minHeight: 360,
  },
  bezelTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B1120',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  bezelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bezelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bezelTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bezelBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  bezelBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bezelBadgePro: {
    backgroundColor: '#F59E0B22',
    borderWidth: 1,
    borderColor: BRAND.colors.accentGold,
  },
  bezelBadgeFree: {
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  bezelBadgeText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '800',
  },
  carScreenBody: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000000',
  },
  carPlayDock: {
    width: 68,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#1E293B',
  },
  dockTopGroup: {
    alignItems: 'center',
  },
  dockClock: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  dockSignalRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  dockSignalText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '700',
  },
  dockWifiText: {
    color: '#94A3B8',
    fontSize: 9,
  },
  dockAppStack: {
    gap: 10,
    alignItems: 'center',
  },
  dockAppIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockAppIconLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  dockHomeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockHomeInnerSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
  },
  stageArea: {
    flex: 1,
    backgroundColor: '#030712',
    position: 'relative',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  overlayCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  standbyPinLabel: {
    color: '#38BDF8',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  standbyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  standbySub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 18,
  },
  safetyBadge: {
    backgroundColor: '#F59E0B22',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  safetyBadgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
  },
  confirmParkedBtn: {
    marginTop: 14,
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmParkedBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  expiredBadge: {
    backgroundColor: '#EF444422',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  expiredBadgeText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
  },
  expiredBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  upgradeFromCarBtn: {
    backgroundColor: BRAND.colors.accentGold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  upgradeFromCarBtnText: {
    color: '#080C14',
    fontSize: 12,
    fontWeight: '800',
  },
  resetFreeDemoBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  resetFreeDemoText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  mirrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#090D16',
  },
  mirrorPhoneMock: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  mirrorPhoneStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mirrorPhoneTime: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  mirrorPhoneRec: {
    color: '#F43F5E',
    fontSize: 11,
    fontWeight: '800',
  },
  mirrorPhoneHeading: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  mirrorAppGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mirrorAppTile: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  mirrorAppTileText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  mirrorDrmFootnote: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 10,
    textAlign: 'center',
  },
  photoStage: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  castedPhoto: {
    width: '100%',
    height: '100%',
  },
  photoCaptionPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#0F172ACC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  photoCaptionText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  videoViewport: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'center',
  },
  cinemaVisualizerStage: {
    flex: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  cinemaVisualizerFit: {
    marginVertical: 22,
    marginHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cinemaSkyGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  cinemaMountainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 110,
    paddingTop: 40,
    opacity: 0.35,
  },
  cinemaPeakLeft: {
    width: 160,
    height: 70,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 60,
    borderTopRightRadius: 40,
  },
  cinemaPeakCenter: {
    width: 220,
    height: 95,
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
  },
  cinemaPeakRight: {
    width: 170,
    height: 65,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 60,
  },
  cinemaRoadDeck: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 24, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  cinemaHorizonLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#38BDF8',
    opacity: 0.6,
  },
  cinemaCenterPlayingCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    maxWidth: 460,
    width: '90%',
  },
  cinemaLiveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cinemaLivePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  cinemaLiveBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cinemaStageMainTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  cinemaStageSub: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  waveBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    height: 64,
  },
  waveBar: {
    width: 8,
    borderRadius: 4,
  },
  nativeVideo: {
    width: '100%',
    height: '100%',
  },
  videoTopGradientHud: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#0B1120D9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudChannelCategory: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  hudVideoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  hudAudioBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hudAudioText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  remoteCursor: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
  },
  remoteCursorInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
  },
  remoteCursorTag: {
    color: '#E0F2FE',
    fontSize: 8,
    fontWeight: '800',
  },
  carBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B1120E6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 10,
  },
  carTransportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carBarBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  carBarBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  carBarPlayBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 14,
  },
  carBarPlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  carTimelineMid: {
    flex: 1,
    alignItems: 'center',
  },
  carTimelineStatus: {
    color: '#94A3B8',
    fontSize: 10,
  },
  carTimecode: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  carAspectBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  carAspectBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
});
