import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
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

  const dockColumn = (
    <View style={styles.carPlayDock}>
      <View style={styles.dockTopGroup}>
        <Text style={styles.dockClock}>12:45</Text>
        <Text style={styles.dockSignalText}>CarPlay</Text>
      </View>

      <View style={styles.dockAppStack}>
        <View style={[styles.dockAppIcon, { backgroundColor: BRAND.colors.accentBlue }]}>
          <Text style={styles.dockAppIconLabel}>P</Text>
        </View>
        <View style={[styles.dockAppIcon, { backgroundColor: '#10B981' }]}>
          <Text style={styles.dockAppIconLabel}>NAV</Text>
        </View>
        <View style={[styles.dockAppIcon, { backgroundColor: '#EF4444' }]}>
          <Text style={styles.dockAppIconLabel}>YT</Text>
        </View>
      </View>

      <View style={styles.dockHomeCircle}>
        <View style={styles.dockHomeInnerSquare} />
      </View>
    </View>
  );

  return (
    <View style={styles.outerFrame}>
      {/* Clean Light Header */}
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
            Car Screen Display · Code {roomCode}
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
                isPro && { color: '#B45309' },
              ]}
            >
              {isPro ? '★ Pro' : `Free ${formatTime(remainingSessionSeconds)}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Main CarPlay Screen Body */}
      <View
        style={[
          styles.carScreenBody,
          steeringSide === 'right' && { flexDirection: 'row-reverse' },
        ]}
      >
        {dockColumn}

        {/* Stage */}
        <View style={styles.stageArea}>
          {connectionTarget === 'disconnected' ? (
            <View style={styles.overlayCentered}>
              <Text style={styles.standbyPinLabel}>CAR CODE: {roomCode}</Text>
              <Text style={styles.standbyTitle}>Waiting for Your iPhone</Text>
              <Text style={styles.standbySub}>
                Open ParkCast on your iPhone and enter code {roomCode}.
              </Text>
            </View>
          ) : !isParkedConfirmed ? (
            <View style={styles.overlayCentered}>
              <Text style={styles.standbyTitle}>
                Video Paused While Driving
              </Text>
              <Text style={styles.standbySub}>
                Park your vehicle to watch video on the car screen.
              </Text>
              <TouchableOpacity
                style={styles.confirmParkedBtn}
                onPress={() => setParkedConfirmed(true)}
              >
                <Text style={styles.confirmParkedBtnText}>
                  Car Is Parked · Show Video
                </Text>
              </TouchableOpacity>
            </View>
          ) : isSessionExpired ? (
            <View style={styles.overlayCentered}>
              <Text style={styles.standbyTitle}>
                15-Minute Free Preview Ended
              </Text>
              <Text style={styles.standbySub}>
                Upgrade to ParkCast Pro on your iPhone for unlimited watching.
              </Text>
              <View style={styles.expiredBtnRow}>
                <TouchableOpacity
                  style={styles.upgradeFromCarBtn}
                  onPress={() => openPaywall()}
                >
                  <Text style={styles.upgradeFromCarBtnText}>
                    Upgrade to Pro
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resetFreeDemoBtn}
                  onPress={resetFreeSessionTimer}
                >
                  <Text style={styles.resetFreeDemoText}>Restart 15m Demo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : mirrorMode === 'screen_broadcast' ? (
            <View style={styles.mirrorContainer}>
              <View style={styles.mirrorPhoneMock}>
                <View style={styles.mirrorPhoneStatus}>
                  <Text style={styles.mirrorPhoneTime}>iPhone Live Mirror</Text>
                  <Text style={styles.mirrorPhoneRec}>● LIVE</Text>
                </View>
                <Text style={styles.mirrorPhoneHeading}>
                  Your iPhone Screen Is Mirroring
                </Text>
                <View style={styles.mirrorAppGrid}>
                  {[
                    { name: 'YouTube', color: '#DC2626' },
                    { name: 'Safari', color: '#2563EB' },
                    { name: 'Photos', color: '#16A34A' },
                    { name: 'Videos', color: '#EA580C' },
                    { name: 'Music', color: '#7C3AED' },
                    { name: 'Maps', color: '#0284C7' },
                  ].map((app) => (
                    <View
                      key={app.name}
                      style={[styles.mirrorAppTile, { backgroundColor: app.color }]}
                    >
                      <Text style={styles.mirrorAppTileText}>{app.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : mirrorMode === 'photo_slideshow' && selectedPhotoUri ? (
            <View style={styles.photoStage}>
              <Image
                source={{ uri: selectedPhotoUri }}
                style={styles.castedPhoto}
                resizeMode="contain"
              />
            </View>
          ) : (
            <View
              style={[
                styles.videoViewport,
                aspectMode === 'cinema' && { transform: [{ scale: 1.06 }] },
              ]}
            >
              <View
                style={[
                  styles.cinemaVisualizerStage,
                  aspectMode === 'fit' && styles.cinemaVisualizerFit,
                ]}
              >
                <View style={styles.cinemaRoadDeck}>
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
                          ? `NOW PLAYING · ${quality}`
                          : 'PAUSED'}
                      </Text>
                    </View>
                    <Text style={styles.cinemaStageMainTitle}>
                      {activeMedia.title}
                    </Text>
                    <Text style={styles.cinemaStageSub}>
                      {activeMedia.subtitle}
                    </Text>

                    <View style={styles.waveBarContainer}>
                      {[24, 42, 32, 52, 38, 56, 44, 28, 48, 36].map(
                        (baseH, idx) => {
                          const dynamicH = isPlaying
                            ? ((baseH + (currentTimeSec * 9 + idx * 7)) % 38) + 14
                            : 12;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.waveBar,
                                {
                                  height: dynamicH,
                                  backgroundColor:
                                    idx % 2 === 0 ? '#2563EB' : '#10B981',
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

              <View pointerEvents="none" style={styles.videoTopGradientHud}>
                <View>
                  <Text style={styles.hudChannelCategory}>
                    NOW PLAYING · {quality}
                  </Text>
                  <Text style={styles.hudVideoTitle}>{activeMedia.title}</Text>
                </View>
                <View style={styles.hudAudioBadge}>
                  <Text style={styles.hudAudioText}>
                    {isMuted ? 'Muted' : `Vol ${volume}%`}
                  </Text>
                </View>
              </View>
            </View>
          )}

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
              <Text style={styles.remoteCursorTag}>Pointer</Text>
            </View>
          )}

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
                    {isPlaying ? 'Pause' : 'Play'}
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
                  {formatTime(currentTimeSec)} / {formatTime(durationSec)}
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
                  Size: {aspectMode.toUpperCase()}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    minHeight: 360,
  },
  bezelTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  bezelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bezelDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  bezelTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  bezelBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  bezelBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bezelBadgePro: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  bezelBadgeFree: {
    backgroundColor: '#EFF6FF',
  },
  bezelBadgeText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  carScreenBody: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
  },
  carPlayDock: {
    width: 68,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  dockTopGroup: {
    alignItems: 'center',
  },
  dockClock: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  dockSignalText: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  dockAppStack: {
    gap: 10,
    alignItems: 'center',
  },
  dockAppIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockAppIconLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  dockHomeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    backgroundColor: '#EFF6FF',
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
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  standbyTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  standbySub: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 19,
  },
  confirmParkedBtn: {
    marginTop: 14,
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  confirmParkedBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  expiredBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  upgradeFromCarBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  upgradeFromCarBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  resetFreeDemoBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  resetFreeDemoText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  mirrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  mirrorPhoneMock: {
    width: '88%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  mirrorPhoneStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mirrorPhoneTime: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  mirrorPhoneRec: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  mirrorPhoneHeading: {
    color: '#0F172A',
    fontSize: 16,
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
    borderRadius: 12,
    alignItems: 'center',
  },
  mirrorAppTileText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  photoStage: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  castedPhoto: {
    width: '100%',
    height: '100%',
  },
  videoViewport: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
  },
  cinemaVisualizerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cinemaVisualizerFit: {
    marginVertical: 20,
    marginHorizontal: 16,
    borderRadius: 20,
  },
  cinemaRoadDeck: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  cinemaCenterPlayingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    maxWidth: 440,
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
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '800',
  },
  cinemaStageMainTitle: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  cinemaStageSub: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  waveBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    height: 56,
  },
  waveBar: {
    width: 8,
    borderRadius: 4,
  },
  videoTopGradientHud: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hudChannelCategory: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '800',
  },
  hudVideoTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  hudAudioBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  hudAudioText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  remoteCursor: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#2563EB',
  },
  remoteCursorInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  remoteCursorTag: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  carBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  carTransportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  carBarBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  carBarBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  carBarPlayBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 16,
  },
  carBarPlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  carTimelineMid: {
    flex: 1,
    alignItems: 'center',
  },
  carTimelineStatus: {
    color: '#64748B',
    fontSize: 11,
  },
  carTimecode: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  carAspectBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  carAspectBtnText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
});
