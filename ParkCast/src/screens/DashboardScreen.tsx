import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  BRAND,
  MEDIA_PRESETS,
  MediaPreset,
  CarScreenTab,
  NavProvider,
} from '../config/brand';
import { useSubscription } from '../context/SubscriptionContext';
import { useCastSession } from '../context/CastSessionContext';

interface DashboardScreenProps {
  onOpenRemote: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onOpenRemote }) => {
  const {
    isPro,
    isTrialActive,
    remainingSessionSeconds,
    openPaywall,
    downgradeToFreeForTesting,
    fastForwardFreeTimerForTesting,
    recordLocalVideoCast,
  } = useSubscription();

  const {
    roomCode,
    connectionTarget,
    relayConnected,
    relayHost,
    carActiveTab,
    carSplitView,
    speedUnit,
    navProvider,
    navDestination,
    activeMedia,
    mirrorMode,
    isPlaying,
    iptvChannels,
    hiddenCategories,
    autoResumeAfterCall,
    autoRefresh24h,
    drmWarning,
    connectToCarReceiver,
    healCarConnection,
    setCarActiveTab,
    toggleCarSplitView,
    toggleSpeedUnit,
    setNavProvider,
    setNavDestination,
    launchExternalNavigation,
    selectMedia,
    playIptvChannel,
    addIptvPlaylist,
    refreshPlaylistsNow,
    toggleCategoryVisibility,
    shufflePlayMedia,
    toggleAutoResumeAfterCall,
    toggleAutoRefresh24h,
    playYouTubeUrlOrQuery,
    castLocalPhotoOrVideo,
    setMirrorMode,
    togglePlayPause,
  } = useCastSession();

  const [pinInput, setPinInput] = useState(roomCode);
  const [relayHostInput, setRelayHostInput] = useState(relayHost);
  const [showConnectionSettings, setShowConnectionSettings] = useState(false);
  const [ytInput, setYtInput] = useState('');
  const [showYtBox, setShowYtBox] = useState(false);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);

  // M3U / Xtream IPTV Modal state
  const [showAddIptvBox, setShowAddIptvBox] = useState(false);
  const [playlistNameInput, setPlaylistNameInput] = useState('');
  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [xtreamUserInput, setXtreamUserInput] = useState('');
  const [xtreamPassInput, setXtreamPassInput] = useState('');

  const formatMinutesLeft = (sec: number) => {
    const m = Math.ceil(sec / 60);
    return `${m} min left`;
  };

  const handleSelectPreset = (preset: MediaPreset) => {
    if (preset.requiresPro && !isPro) {
      openPaywall('Upgrade to ParkCast Pro to watch all Full HD channels without time limits.');
      return;
    }
    selectMedia(preset);
    onOpenRemote();
  };

  const handleStartScreenMirror = () => {
    if (!isPro) {
      openPaywall('Upgrade to ParkCast Pro to mirror your iPhone screen onto your car display.');
      return;
    }
    setMirrorMode('screen_broadcast');
    onOpenRemote();
  };

  const handlePickCameraRoll = async (asVideo: boolean) => {
    if (asVideo && !recordLocalVideoCast()) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: asVideo ? ['videos'] : ['images'],
        quality: 0.75,
        base64: !asVideo,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploadingLabel(
          asVideo ? 'Sending video to car screen...' : 'Sending photo to car screen...'
        );
        await castLocalPhotoOrVideo(
          asset.uri,
          asset.fileName || (asVideo ? 'Phone Video.mp4' : 'Phone Photo.jpg'),
          asVideo,
          asset.base64 || undefined
        );
        setUploadingLabel(null);
        onOpenRemote();
        return;
      }
    } catch {
      setUploadingLabel(null);
    }

    if (asVideo) {
      await castLocalPhotoOrVideo(
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        'Sample Phone Video.mp4',
        true
      );
    } else {
      await castLocalPhotoOrVideo(
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
        'Sample Phone Photo.jpg',
        false
      );
    }
    onOpenRemote();
  };

  const allCategories = Array.from(new Set(iptvChannels.map((c) => c.group)));
  const visibleIptvChannels = iptvChannels.filter(
    (c) => !hiddenCategories.includes(c.group)
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Simple, Friendly Header */}
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
          <View>
            <Text style={styles.brandTitle}>{BRAND.appName}</Text>
            <Text style={styles.brandSubtitle}>Car Video, IPTV & Mirror</Text>
          </View>
        </View>

        <View style={styles.headerRightGroup}>
          <TouchableOpacity
            testID="toggle-speed-unit-btn"
            style={styles.unitPill}
            onPress={toggleSpeedUnit}
          >
            <Text style={styles.unitPillText}>{speedUnit.toUpperCase()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="header-upgrade-btn"
            style={[styles.planPill, isPro ? styles.planPillPro : styles.planPillFree]}
            onPress={() => openPaywall()}
          >
            <Text style={[styles.planPillText, isPro && styles.planPillTextPro]}>
              {isPro
                ? isTrialActive
                  ? '★ Pro Trial'
                  : '★ Pro Plan'
                : `Free · ${formatMinutesLeft(remainingSessionSeconds)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Clean Connection Bar + Zero-Drop Self-Heal */}
      <View style={styles.connectionCard}>
        <View style={styles.connectionMainRow}>
          <View style={styles.connectionLeft}>
            <View
              style={[
                styles.greenDot,
                {
                  backgroundColor:
                    connectionTarget !== 'disconnected' ? '#10B981' : '#F59E0B',
                },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.connectionTitle}>
                {relayConnected
                  ? `Connected to Car Screen (Code ${roomCode})`
                  : `Car Screen Code: ${roomCode} · Universal CarPlay`}
              </Text>
              <Text style={styles.connectionSub}>
                Works in all CarPlay cars (iOS 27.2+ ready) & Car Browsers
              </Text>
            </View>
          </View>

          <View style={styles.connectionBtnGroup}>
            <TouchableOpacity
              testID="heal-connection-btn"
              style={styles.healBtn}
              onPress={healCarConnection}
            >
              <Text style={styles.healBtnText}>Re-Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="connect-car-pin-btn"
              style={styles.changeBtn}
              onPress={() => setShowConnectionSettings(!showConnectionSettings)}
            >
              <Text style={styles.changeBtnText}>
                {showConnectionSettings ? 'Close' : 'Change'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showConnectionSettings && (
          <View style={styles.connectionExpandBox}>
            <Text style={styles.inputLabel}>4-Digit Car Screen Code</Text>
            <TextInput
              style={styles.textInput}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="4829"
              placeholderTextColor="#94A3B8"
              maxLength={6}
            />
            <Text style={styles.inputLabel}>Car Display Address (Wi-Fi / Cloud Relay)</Text>
            <TextInput
              style={styles.textInput}
              value={relayHostInput}
              onChangeText={setRelayHostInput}
              placeholder="10.0.0.87:4848"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.saveConnectBtn}
              onPress={() => {
                connectToCarReceiver(pinInput, undefined, relayHostInput);
                setShowConnectionSettings(false);
              }}
            >
              <Text style={styles.saveConnectBtnText}>Save & Connect</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* CarPlay Top Bar Mode Switcher (Library · Browser · Mirror · Map & Nav) + Split-View */}
      <View style={styles.carModeStripCard}>
        <View style={styles.carModeStripHeader}>
          <Text style={styles.carModeStripTitle}>Car Screen Active Tab</Text>
          <TouchableOpacity
            testID="toggle-car-split-btn"
            style={[styles.splitTogglePill, carSplitView && styles.splitTogglePillActive]}
            onPress={toggleCarSplitView}
          >
            <Text
              style={[
                styles.splitToggleText,
                carSplitView && styles.splitToggleTextActive,
              ]}
            >
              {carSplitView ? '◫ Split-View ON' : '◫ Split-View OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.carTabRow}>
          {(
            [
              { id: 'library', label: '🎬 Library' },
              { id: 'browser', label: '🌐 Browser' },
              { id: 'mirror', label: '📱 Mirror' },
              { id: 'map', label: '🗺 Map & Nav' },
            ] as { id: CarScreenTab; label: string }[]
          ).map((tab) => {
            const active = carActiveTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                testID={`car-tab-${tab.id}`}
                style={[styles.carTabPill, active && styles.carTabPillActive]}
                onPress={() => {
                  if (tab.id === 'mirror' && !isPro) {
                    openPaywall('Upgrade to ParkCast Pro for 60fps whole-phone screen mirroring.');
                    return;
                  }
                  setCarActiveTab(tab.id);
                }}
              >
                <Text style={[styles.carTabText, active && styles.carTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* DRM Smart Warning Banner if user opened Netflix/Prime */}
      {drmWarning && (
        <View style={styles.drmWarningBanner}>
          <Text style={styles.drmWarningText}>{drmWarning}</Text>
        </View>
      )}

      {/* Uploading Progress Pill */}
      {uploadingLabel && (
        <View style={styles.uploadingBanner}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.uploadingBannerText}>{uploadingLabel}</Text>
        </View>
      )}

      {/* 4 Big, Simple Action Tiles */}
      <Text style={styles.sectionTitle}>What would you like to show on your car screen?</Text>

      <View style={styles.tileGrid}>
        {/* Tile 1: Watch YouTube / Car Browser */}
        <TouchableOpacity
          testID="card-youtube-web"
          style={styles.actionTile}
          onPress={() => setShowYtBox(!showYtBox)}
        >
          <View style={[styles.tileBadgeCircle, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.tileBadgeIcon, { color: '#DC2626' }]}>▶</Text>
          </View>
          <Text style={styles.tileTitle}>Watch YouTube</Text>
          <Text style={styles.tileDesc}>Play YouTube & web videos with car touch & trackpad</Text>
        </TouchableOpacity>

        {/* Tile 2: Phone Photos */}
        <TouchableOpacity
          testID="pick-local-photo-btn"
          style={styles.actionTile}
          onPress={() => handlePickCameraRoll(false)}
        >
          <View style={[styles.tileBadgeCircle, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.tileBadgeIcon, { color: '#16A34A' }]}>🖼</Text>
          </View>
          <Text style={styles.tileTitle}>Phone Photos</Text>
          <Text style={styles.tileDesc}>Show photos from your iPhone on the car screen</Text>
        </TouchableOpacity>

        {/* Tile 3: Phone Videos */}
        <TouchableOpacity
          testID="pick-local-video-btn"
          style={styles.actionTile}
          onPress={() => handlePickCameraRoll(true)}
        >
          <View style={[styles.tileBadgeCircle, { backgroundColor: '#DBEAFE' }]}>
            <Text style={[styles.tileBadgeIcon, { color: '#2563EB' }]}>🎬</Text>
          </View>
          <Text style={styles.tileTitle}>Phone Videos</Text>
          <Text style={styles.tileDesc}>Play videos saved in your iPhone camera roll</Text>
        </TouchableOpacity>

        {/* Tile 4: Mirror My Screen */}
        <TouchableOpacity
          testID="card-screen-mirror"
          style={[
            styles.actionTile,
            mirrorMode === 'screen_broadcast' && styles.actionTileActive,
          ]}
          onPress={handleStartScreenMirror}
        >
          <View style={styles.tileTopRow}>
            <View style={[styles.tileBadgeCircle, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[styles.tileBadgeIcon, { color: '#7C3AED' }]}>📱</Text>
            </View>
            {!isPro && (
              <View style={styles.proTag}>
                <Text style={styles.proTagText}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={styles.tileTitle}>Mirror Screen</Text>
          <Text style={styles.tileDesc}>Mirror whole iPhone screen & apps live at 60fps</Text>
        </TouchableOpacity>
      </View>

      {/* Simple YouTube Link Box */}
      {showYtBox && (
        <View style={styles.youtubePopupCard}>
          <Text style={styles.youtubePopupTitle}>Play a YouTube Video in Your Car</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Paste YouTube link or search query..."
            placeholderTextColor="#94A3B8"
            value={ytInput}
            onChangeText={setYtInput}
            autoCapitalize="none"
          />
          <View style={styles.youtubeBtnRow}>
            <TouchableOpacity
              style={styles.youtubePrimaryBtn}
              onPress={() => {
                playYouTubeUrlOrQuery(ytInput || 'https://youtu.be/ysz5S6PUM-U');
                setYtInput('');
                setShowYtBox(false);
                onOpenRemote();
              }}
            >
              <Text style={styles.youtubePrimaryBtnText}>Play on Car Screen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Now Playing Mini Bar */}
      <View style={styles.nowPlayingBar}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={styles.nowPlayingLabel}>NOW ON CAR SCREEN</Text>
          <Text style={styles.nowPlayingTitle} numberOfLines={1}>
            {mirrorMode === 'screen_broadcast'
              ? 'Live iPhone Screen Mirror'
              : mirrorMode === 'photo_slideshow'
              ? 'iPhone Photo Display'
              : activeMedia.title}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.nowPlayingPlayBtn}
          onPress={togglePlayPause}
        >
          <Text style={styles.nowPlayingPlayText}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="open-remote-btn"
          style={styles.nowPlayingRemoteBtn}
          onPress={onOpenRemote}
        >
          <Text style={styles.nowPlayingRemoteText}>Remote →</Text>
        </TouchableOpacity>
      </View>

      {/* Live TV / M3U / Xtream IPTV Channels Section */}
      <View style={styles.iptvHeaderRow}>
        <Text style={styles.sectionTitle}>Live TV & M3U / Xtream Playlists</Text>
        <View style={styles.iptvActionRow}>
          <TouchableOpacity
            testID="shuffle-play-btn"
            style={styles.smallActionBtn}
            onPress={() => {
              shufflePlayMedia();
              onOpenRemote();
            }}
          >
            <Text style={styles.smallActionBtnText}>🔀 Shuffle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="refresh-iptv-btn"
            style={styles.smallActionBtn}
            onPress={refreshPlaylistsNow}
          >
            <Text style={styles.smallActionBtnText}>↻ Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="add-iptv-playlist-btn"
            style={[styles.smallActionBtn, styles.smallActionBtnPrimary]}
            onPress={() => setShowAddIptvBox(!showAddIptvBox)}
          >
            <Text style={styles.smallActionBtnPrimaryText}>+ Add M3U / Xtream</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add M3U / Xtream Form */}
      {showAddIptvBox && (
        <View style={styles.youtubePopupCard}>
          <Text style={styles.youtubePopupTitle}>Add M3U Link, #EXTINF Text, or Xtream Login</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Playlist Name (e.g. My Live Sports)"
            placeholderTextColor="#94A3B8"
            value={playlistNameInput}
            onChangeText={setPlaylistNameInput}
          />
          <TextInput
            style={styles.textInput}
            placeholder="https://example.com/playlist.m3u8 or #EXTINF..."
            placeholderTextColor="#94A3B8"
            value={playlistUrlInput}
            onChangeText={setPlaylistUrlInput}
            autoCapitalize="none"
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="Xtream Username (Optional)"
              placeholderTextColor="#94A3B8"
              value={xtreamUserInput}
              onChangeText={setXtreamUserInput}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="Xtream Password (Optional)"
              placeholderTextColor="#94A3B8"
              value={xtreamPassInput}
              onChangeText={setXtreamPassInput}
              secureTextEntry
            />
          </View>
          <View style={styles.youtubeBtnRow}>
            <TouchableOpacity
              testID="save-iptv-playlist-btn"
              style={styles.youtubePrimaryBtn}
              onPress={() => {
                addIptvPlaylist(
                  playlistNameInput || 'Custom M3U Playlist',
                  playlistUrlInput || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                  xtreamUserInput,
                  xtreamPassInput
                );
                setPlaylistNameInput('');
                setPlaylistUrlInput('');
                setXtreamUserInput('');
                setXtreamPassInput('');
                setShowAddIptvBox(false);
              }}
            >
              <Text style={styles.youtubePrimaryBtnText}>Import Playlist</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Category Show/Hide Filter Pills + Smart Playback Toggles */}
      <View style={styles.categoryFilterWrap}>
        {allCategories.map((cat) => {
          const isHidden = hiddenCategories.includes(cat);
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, isHidden && styles.catChipHidden]}
              onPress={() => toggleCategoryVisibility(cat)}
            >
              <Text style={[styles.catChipText, isHidden && styles.catChipTextHidden]}>
                {isHidden ? `Hidden: ${cat}` : `✓ ${cat}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.smartTogglesRow}>
        <TouchableOpacity
          testID="toggle-auto-resume-call-btn"
          style={[styles.smartToggleChip, autoResumeAfterCall && styles.smartToggleChipOn]}
          onPress={toggleAutoResumeAfterCall}
        >
          <Text style={styles.smartToggleText}>
            {autoResumeAfterCall ? '✓ Auto-Resume After Call' : '○ Auto-Resume After Call'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="toggle-auto-refresh-24h-btn"
          style={[styles.smartToggleChip, autoRefresh24h && styles.smartToggleChipOn]}
          onPress={toggleAutoRefresh24h}
        >
          <Text style={styles.smartToggleText}>
            {autoRefresh24h ? '✓ 24h Playlist Auto-Refresh' : '○ 24h Playlist Auto-Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* IPTV Channel List */}
      {visibleIptvChannels.slice(0, 4).map((ch) => {
        const isCurrent = activeMedia.id === ch.id && mirrorMode === 'off';
        return (
          <TouchableOpacity
            key={ch.id}
            style={[styles.videoRowCard, isCurrent && styles.videoRowCardActive]}
            onPress={() => {
              playIptvChannel(ch);
              onOpenRemote();
            }}
          >
            <View style={[styles.videoColorDot, { backgroundColor: '#0284C7' }]}>
              <Text style={styles.videoDotIcon}>TV</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.videoRowTitle}>{ch.name}</Text>
              <Text style={styles.videoRowSub}>{ch.group} · M3U Live Stream</Text>
            </View>
            <Text style={styles.videoPlayLink}>{isCurrent ? 'Playing' : 'Watch'}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Turn-by-Turn Car Navigation Switcher (Apple Maps · Waze · Google Maps) */}
      <View style={styles.navCard}>
        <View style={styles.navHeaderRow}>
          <View>
            <Text style={styles.navCardTitle}>Car Turn-by-Turn Navigation</Text>
            <Text style={styles.navCardSub}>
              Choose your preferred navigator ({speedUnit === 'mph' ? 'Miles & MPH' : 'KM & KM/H'})
            </Text>
          </View>
        </View>
        <View style={styles.navProviderRow}>
          {(
            [
              { id: 'apple_maps', label: 'Apple Maps' },
              { id: 'waze', label: 'Waze' },
              { id: 'google_maps', label: 'Google Maps' },
            ] as { id: NavProvider; label: string }[]
          ).map((p) => {
            const active = navProvider === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                testID={`nav-provider-${p.id}`}
                style={[styles.navProviderBtn, active && styles.navProviderBtnActive]}
                onPress={() => setNavProvider(p.id)}
              >
                <Text
                  style={[
                    styles.navProviderBtnText,
                    active && styles.navProviderBtnTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.navInputRow}>
          <TextInput
            style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
            value={navDestination}
            onChangeText={setNavDestination}
            placeholder="Enter destination..."
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity
            style={styles.navGoBtn}
            onPress={() => launchExternalNavigation(navProvider, navDestination)}
          >
            <Text style={styles.navGoBtnText}>Route</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ready-to-Watch Videos */}
      <Text style={styles.sectionTitle}>Quick-Play Sample Videos</Text>
      {MEDIA_PRESETS.map((item) => {
        const isCurrent = activeMedia.id === item.id && mirrorMode === 'off';
        return (
          <TouchableOpacity
            key={item.id}
            testID={`preset-${item.id}`}
            style={[styles.videoRowCard, isCurrent && styles.videoRowCardActive]}
            onPress={() => handleSelectPreset(item)}
          >
            <View
              style={[
                styles.videoColorDot,
                { backgroundColor: item.thumbnailColor },
              ]}
            >
              <Text style={styles.videoDotIcon}>▶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.videoRowTitleWrap}>
                <Text style={styles.videoRowTitle}>{item.title}</Text>
                {item.requiresPro && !isPro && (
                  <View style={styles.proTag}>
                    <Text style={styles.proTagText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.videoRowSub}>
                {item.subtitle} · {item.durationLabel}
              </Text>
            </View>
            <Text style={styles.videoPlayLink}>
              {isCurrent ? 'Playing' : 'Play'}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Simple Upgrade Card for Free Users */}
      {!isPro ? (
        <View style={styles.upgradeBannerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.upgradeBannerTitle}>Upgrade to ParkCast Pro</Text>
            <Text style={styles.upgradeBannerSub}>
              Remove the 15-minute time limit, unlock Full HD 1080p, and mirror your screen.
            </Text>
          </View>
          <TouchableOpacity
            testID="unlock-pro-banner-btn"
            style={styles.upgradeBannerBtn}
            onPress={() => openPaywall()}
          >
            <Text style={styles.upgradeBannerBtnText}>Try Free</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.proActiveFooter}>
          <Text style={styles.proActiveFooterText}>
            ★ ParkCast Pro is active (Unlimited HD & Screen Mirroring unlocked)
          </Text>
          <TouchableOpacity
            testID="reset-to-free-btn"
            onPress={downgradeToFreeForTesting}
          >
            <Text style={styles.switchBackLink}>Switch back to Free mode</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isPro && (
        <TouchableOpacity
          testID="simulate-timer-expiry-btn"
          style={styles.subtleTestLink}
          onPress={fastForwardFreeTimerForTesting}
        >
          <Text style={styles.subtleTestLinkText}>
            Demo: Test what happens when 15-min Free timer ends
          </Text>
        </TouchableOpacity>
      )}
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
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  unitPillText: {
    color: BRAND.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: BRAND.colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  brandTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
  },
  planPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  planPillFree: {
    backgroundColor: '#E0E7FF',
  },
  planPillPro: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  planPillText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  planPillTextPro: {
    color: '#B45309',
  },
  connectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  connectionMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  connectionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  healBtnText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectionTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  connectionSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  changeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  changeBtnText: {
    color: BRAND.colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
  },
  connectionExpandBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  carModeStripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  carModeStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  carModeStripTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  splitTogglePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  splitTogglePillActive: {
    backgroundColor: '#DBEAFE',
  },
  splitToggleText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  splitToggleTextActive: {
    color: '#1D4ED8',
  },
  carTabRow: {
    flexDirection: 'row',
    gap: 6,
  },
  carTabPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  carTabPillActive: {
    backgroundColor: BRAND.colors.accentBlue,
    borderColor: BRAND.colors.accentBlue,
  },
  carTabText: {
    color: BRAND.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  carTabTextActive: {
    color: '#FFFFFF',
  },
  drmWarningBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  drmWarningText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  inputLabel: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    color: BRAND.colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 10,
  },
  saveConnectBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveConnectBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DBEAFE',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  uploadingBannerText: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  actionTile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  actionTileActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF',
  },
  tileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tileBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileBadgeIcon: {
    fontSize: 20,
    fontWeight: '800',
  },
  tileTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  tileDesc: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  proTag: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proTagText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
  },
  youtubePopupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  youtubePopupTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  youtubeBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  youtubePrimaryBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  youtubePrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  nowPlayingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  nowPlayingLabel: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nowPlayingTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  nowPlayingPlayBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
  },
  nowPlayingPlayText: {
    color: BRAND.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  nowPlayingRemoteBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nowPlayingRemoteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  iptvHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  iptvActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  smallActionBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  smallActionBtnText: {
    color: BRAND.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  smallActionBtnPrimary: {
    backgroundColor: BRAND.colors.accentBlue,
    borderColor: BRAND.colors.accentBlue,
  },
  smallActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryFilterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  catChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  catChipHidden: {
    backgroundColor: '#F1F5F9',
  },
  catChipText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  catChipTextHidden: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  smartTogglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  smartToggleChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smartToggleChipOn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  smartToggleText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  navCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  navHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navCardTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  navCardSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  navProviderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  navProviderBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  navProviderBtnActive: {
    backgroundColor: '#10B981',
  },
  navProviderBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  navProviderBtnTextActive: {
    color: '#FFFFFF',
  },
  navInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  navGoBtn: {
    backgroundColor: BRAND.colors.accentBlue,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
  },
  navGoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  videoRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BRAND.colors.borderSubtle,
  },
  videoRowCardActive: {
    borderColor: BRAND.colors.accentBlue,
    backgroundColor: '#F8FAFC',
  },
  videoColorDot: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  videoDotIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  videoRowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoRowTitle: {
    color: BRAND.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  videoRowSub: {
    color: BRAND.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  videoPlayLink: {
    color: BRAND.colors.accentBlue,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  upgradeBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 12,
  },
  upgradeBannerTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '800',
  },
  upgradeBannerSub: {
    color: '#B45309',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  upgradeBannerBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  upgradeBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  proActiveFooter: {
    marginTop: 10,
    padding: 14,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  proActiveFooterText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  switchBackLink: {
    color: '#047857',
    fontSize: 12,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  subtleTestLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  subtleTestLinkText: {
    color: '#94A3B8',
    fontSize: 11,
  },
});
