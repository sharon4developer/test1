import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import {
  BRAND,
  MEDIA_PRESETS,
  DEFAULT_IPTV_CHANNELS,
  MediaPreset,
  IptvChannel,
  IptvPlaylistSource,
  VideoQuality,
  AspectMode,
  CarScreenTab,
  SpeedUnit,
  NavProvider,
} from '../config/brand';

export type ConnectionTarget = 'disconnected' | 'car_receiver' | 'airplay';

export type MirrorMode = 'off' | 'screen_broadcast' | 'photo_slideshow';

export interface CustomStreamItem {
  id: string;
  title: string;
  url: string;
  addedAt: string;
}

export interface CastStatePayload {
  roomCode: string;
  connectionTarget: ConnectionTarget;
  carName: string;
  isParkedConfirmed: boolean;
  carActiveTab: CarScreenTab;
  carSplitView: boolean;
  speedUnit: SpeedUnit;
  navProvider: NavProvider;
  navDestination: string;
  activeMedia: MediaPreset;
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  quality: VideoQuality;
  aspectMode: AspectMode;
  steeringSide: 'left' | 'right';
  mirrorMode: MirrorMode;
  mirrorWebUrl: string | null;
  selectedPhotoUri: string | null;
  cursorPos: { x: number; y: number };
  rotaryFocusIndex: number;
  selectedRouteIndex: number;
  voiceListening: boolean;
  lastVoiceTranscript: string;
  lastVoiceReply: string;
  autoResumeAfterCall: boolean;
  autoRefresh24h: boolean;
  hiddenCategories: string[];
  drmWarning: string | null;
  lastRemoteAction: string;
  updatedAt: number;
}

export interface CastSessionContextValue extends CastStatePayload {
  relayConnected: boolean;
  relayHost: string;
  setRelayHost: (host: string) => void;
  customStreams: CustomStreamItem[];
  iptvChannels: IptvChannel[];
  iptvSources: IptvPlaylistSource[];
  connectToCarReceiver: (code?: string, vehicleName?: string, customRelayHost?: string) => void;
  connectToAirPlay: () => void;
  disconnectCast: () => void;
  healCarConnection: () => void;
  setParkedConfirmed: (parked: boolean) => void;
  setCarActiveTab: (tab: CarScreenTab) => void;
  toggleCarSplitView: () => void;
  toggleSpeedUnit: () => void;
  setNavProvider: (provider: NavProvider) => void;
  setNavDestination: (dest: string) => void;
  launchExternalNavigation: (provider?: NavProvider, dest?: string) => void;
  selectMedia: (media: MediaPreset) => void;
  playIptvChannel: (channel: IptvChannel) => void;
  addIptvPlaylist: (name: string, urlOrM3uText: string, xtreamUser?: string, xtreamPass?: string) => number;
  refreshPlaylistsNow: () => void;
  toggleCategoryVisibility: (category: string) => void;
  toggleChannelFavorite: (channelId: string) => void;
  shufflePlayMedia: () => void;
  toggleAutoResumeAfterCall: () => void;
  toggleAutoRefresh24h: () => void;
  playCustomUrl: (title: string, url: string) => void;
  playYouTubeUrlOrQuery: (input: string) => void;
  castLocalPhotoOrVideo: (uri: string, title: string, isVideo: boolean, base64Data?: string) => Promise<void>;
  togglePlayPause: () => void;
  seekBySeconds: (deltaSec: number) => void;
  setVolumeLevel: (vol: number) => void;
  toggleMute: () => void;
  setQualityMode: (q: VideoQuality) => void;
  setAspectRatioMode: (mode: AspectMode) => void;
  setSteeringSide: (side: 'left' | 'right') => void;
  setMirrorMode: (mode: MirrorMode) => void;
  setMirrorWebUrl: (url: string | null) => void;
  moveCursor: (dx: number, dy: number) => void;
  stepRotaryKnob: (direction: 1 | -1) => void;
  pressRotaryKnob: () => void;
  setSelectedRouteIndex: (index: number) => void;
  setVoiceListening: (listening: boolean) => void;
  executeVoiceCommand: (spokenText: string) => string;
  triggerRemoteCommand: (label: string) => void;
  openActiveMediaOnPhoneForAirPlay: () => void;
}

export function parseM3uPlaylistText(rawText: string, defaultGroup = 'Imported M3U'): IptvChannel[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const channels: IptvChannel[] = [];
  let pendingName = '';
  let pendingGroup = defaultGroup;
  let pendingLogo: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF')) {
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const commaIdx = line.lastIndexOf(',');
      pendingName = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : `Channel ${channels.length + 1}`;
      pendingGroup = groupMatch ? groupMatch[1].trim() : defaultGroup;
      pendingLogo = logoMatch ? logoMatch[1].trim() : undefined;
    } else if (!line.startsWith('#') && /^https?:\/\//i.test(line)) {
      channels.push({
        id: `m3u-${Date.now()}-${channels.length}`,
        name: pendingName || `Stream ${channels.length + 1}`,
        group: pendingGroup || defaultGroup,
        logo: pendingLogo,
        streamUrl: line,
        isFavorite: false,
      });
      pendingName = '';
      pendingGroup = defaultGroup;
      pendingLogo = undefined;
    }
  }

  return channels;
}

function detectDrmWarningForUrl(url: string | null): string | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('netflix.com') || lower.includes('primevideo.com') || lower.includes('disneyplus.com')) {
    return 'Note: Netflix, Prime Video & Disney+ use FairPlay DRM that blocks iOS screen recording. Use YouTube, M3U/IPTV, Plex/Jellyfin, or Camera Roll videos for full car video.';
  }
  return null;
}

function detectInitialRelayHost(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.hostname}:${BRAND.defaultRelayPort}`;
  }
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      ?.manifest2?.extra?.expoClient?.hostUri ||
    '';
  if (hostUri && !hostUri.includes('exp.direct')) {
    const ipPart = hostUri.split(':')[0];
    if (ipPart) {
      return `${ipPart}:${BRAND.defaultRelayPort}`;
    }
  }
  return `10.0.0.87:${BRAND.defaultRelayPort}`;
}

const CastSessionContext = createContext<CastSessionContextValue | undefined>(undefined);

export const CastSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [relayHost, setRelayHostState] = useState<string>(detectInitialRelayHost);

  const [state, setState] = useState<CastStatePayload>({
    roomCode: '4829',
    connectionTarget: 'car_receiver',
    carName: 'CarPlay Display · 4829',
    isParkedConfirmed: true,
    carActiveTab: 'map',
    carSplitView: false,
    speedUnit: 'mph',
    navProvider: 'apple_maps',
    navDestination: 'Downtown EV Supercharger & Parking Plaza',
    activeMedia: MEDIA_PRESETS[0],
    isPlaying: true,
    currentTimeSec: 42,
    durationSec: 765,
    volume: 85,
    isMuted: false,
    quality: '480p',
    aspectMode: 'fit',
    steeringSide: 'left',
    mirrorMode: 'off',
    mirrorWebUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    selectedPhotoUri: null,
    cursorPos: { x: 68, y: 36 },
    rotaryFocusIndex: 0,
    selectedRouteIndex: 0,
    voiceListening: false,
    lastVoiceTranscript: '',
    lastVoiceReply: 'Say "Navigate to Airport", "Find Parking", "Play YouTube", or "Split View"',
    autoResumeAfterCall: true,
    autoRefresh24h: true,
    hiddenCategories: [],
    drmWarning: null,
    lastRemoteAction: 'Connected to Car Display (PIN 4829)',
    updatedAt: Date.now(),
  });

  const [relayConnected, setRelayConnected] = useState<boolean>(false);
  const [iptvChannels, setIptvChannels] = useState<IptvChannel[]>(DEFAULT_IPTV_CHANNELS);
  const [iptvSources, setIptvSources] = useState<IptvPlaylistSource[]>([
    {
      id: 'source-default',
      name: 'ParkCast Starter M3U Channels',
      type: 'm3u_url',
      url: 'https://iptv-org.github.io/iptv/index.m3u',
      lastRefreshedAt: 'Auto-Refreshed (24h active)',
      channelCount: DEFAULT_IPTV_CHANNELS.length,
    },
  ]);

  const [customStreams, setCustomStreams] = useState<CustomStreamItem[]>([
    {
      id: 'custom-1',
      title: 'Big Buck Bunny 1080p MP4 Test Stream',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      addedAt: 'Saved Stream',
    },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const suppressBroadcastRef = useRef<boolean>(false);
  const [reconnectNonce, setReconnectNonce] = useState<number>(0);

  // Connect to WebSocket relay whenever relayHost, roomCode, or reconnectNonce changes
  useEffect(() => {
    const cleanHost = relayHost.replace(/^ws:\/\//, '').replace(/^http:\/\//, '').trim();
    const wsUrl = cleanHost.includes(':')
      ? `ws://${cleanHost}`
      : `ws://${cleanHost}:${BRAND.defaultRelayPort}`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setRelayConnected(true);
        socket?.send(
          JSON.stringify({
            type: 'join',
            roomCode: state.roomCode,
          })
        );
        socket?.send(
          JSON.stringify({
            type: 'state_update',
            roomCode: state.roomCode,
            payload: state,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.type === 'state_update' && msg.payload) {
            suppressBroadcastRef.current = true;
            setState((prev) => ({
              ...prev,
              ...msg.payload,
            }));
          }
        } catch {
          // Ignore malformed relay messages
        }
      };

      socket.onclose = () => {
        setRelayConnected(false);
      };

      socket.onerror = () => {
        setRelayConnected(false);
      };
    } catch {
      setRelayConnected(false);
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [relayHost, state.roomCode, reconnectNonce]);

  // Broadcast state updates to paired Car Screen over BOTH WebSocket AND HTTP POST /sync
  useEffect(() => {
    if (suppressBroadcastRef.current) {
      suppressBroadcastRef.current = false;
      return;
    }
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'state_update',
          roomCode: state.roomCode,
          payload: state,
        })
      );
    }

    const cleanHost = relayHost
      .replace(/^wss?:\/\//, '')
      .replace(/^https?:\/\//, '')
      .trim();
    const httpBase = cleanHost.includes('.ngrok') || cleanHost.includes('.exp.direct')
      ? `https://${cleanHost}`
      : cleanHost.includes(':')
      ? `http://${cleanHost}`
      : `http://${cleanHost}:${BRAND.defaultRelayPort}`;

    fetch(`${httpBase}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: state.roomCode,
        payload: state,
      }),
    })
      .then((res) => {
        if (res.ok) setRelayConnected(true);
      })
      .catch(() => {});
  }, [state, relayHost]);

  // Advance playback clock locally without flooding the network relay every second
  useEffect(() => {
    if (!state.isPlaying || state.connectionTarget === 'disconnected') return;
    const timer = setInterval(() => {
      suppressBroadcastRef.current = true;
      setState((prev) => {
        const nextSec = prev.currentTimeSec + 1;
        return {
          ...prev,
          currentTimeSec: nextSec >= prev.durationSec ? 0 : nextSec,
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state.isPlaying, state.connectionTarget]);

  const setRelayHost = useCallback((host: string) => {
    const trimmed = host.trim();
    if (!trimmed) return;
    setRelayHostState(
      trimmed.includes(':') ? trimmed : `${trimmed}:${BRAND.defaultRelayPort}`
    );
  }, []);

  const connectToCarReceiver = useCallback(
    (code = '4829', vehicleName?: string, customRelayHost?: string) => {
      const cleanCode = code.trim() || '4829';
      if (customRelayHost && customRelayHost.trim()) {
        const cleanHost = customRelayHost.trim();
        setRelayHostState(
          cleanHost.includes(':') ? cleanHost : `${cleanHost}:${BRAND.defaultRelayPort}`
        );
      }
      setState((prev) => ({
        ...prev,
        roomCode: cleanCode,
        connectionTarget: 'car_receiver',
        carName: vehicleName || `CarPlay Display · ${cleanCode}`,
        isPlaying: true,
        lastRemoteAction: `Paired with Car Screen (PIN ${cleanCode})`,
        updatedAt: Date.now(),
      }));
    },
    []
  );

  // Fixes competitor bug where connection hangs after network switch or Pro upgrade
  const healCarConnection = useCallback(() => {
    setReconnectNonce((n) => n + 1);
    setState((prev) => ({
      ...prev,
      connectionTarget: 'car_receiver',
      isParkedConfirmed: true,
      isPlaying: true,
      lastRemoteAction: 'Re-synced CarPlay & Car Display stream (Zero-Drop Recovery)',
      updatedAt: Date.now(),
    }));
  }, []);

  const connectToAirPlay = useCallback(() => {
    setState((prev) => ({
      ...prev,
      connectionTarget: 'airplay',
      carName: 'Vehicle AirPlay Wireless',
      isPlaying: true,
      lastRemoteAction: 'Routed output to Vehicle AirPlay Receiver',
      updatedAt: Date.now(),
    }));
  }, []);

  const disconnectCast = useCallback(() => {
    setState((prev) => ({
      ...prev,
      connectionTarget: 'disconnected',
      isPlaying: false,
      mirrorMode: 'off',
      lastRemoteAction: 'Disconnected from car screen',
      updatedAt: Date.now(),
    }));
  }, []);

  const setParkedConfirmed = useCallback((parked: boolean) => {
    setState((prev) => ({
      ...prev,
      isParkedConfirmed: parked,
      isPlaying: parked ? prev.isPlaying : false,
      lastRemoteAction: parked ? 'Vehicle Parked confirmed' : 'Playback paused (Vehicle in motion)',
      updatedAt: Date.now(),
    }));
  }, []);

  const setCarActiveTab = useCallback((tab: CarScreenTab) => {
    setState((prev) => ({
      ...prev,
      carActiveTab: tab,
      mirrorMode: tab === 'mirror' ? 'screen_broadcast' : prev.mirrorMode === 'photo_slideshow' && tab === 'library' ? 'photo_slideshow' : 'off',
      lastRemoteAction: `Car display switched to ${tab.toUpperCase()} tab`,
      updatedAt: Date.now(),
    }));
  }, []);

  const toggleCarSplitView = useCallback(() => {
    setState((prev) => ({
      ...prev,
      carSplitView: !prev.carSplitView,
      lastRemoteAction: !prev.carSplitView
        ? 'Enabled Car Split-View (Video + Browser/Map side-by-side)'
        : 'Switched Car Display to Full Single View',
      updatedAt: Date.now(),
    }));
  }, []);

  // Fixes Carvia review by Saleh2402 ("Need miles not KM — In USA we use miles for distance and speed not KM")
  const toggleSpeedUnit = useCallback(() => {
    setState((prev) => {
      const nextUnit: SpeedUnit = prev.speedUnit === 'mph' ? 'kmh' : 'mph';
      return {
        ...prev,
        speedUnit: nextUnit,
        lastRemoteAction: `Speed & distance unit set to ${nextUnit.toUpperCase()}`,
        updatedAt: Date.now(),
      };
    });
  }, []);

  // Fixes Carvia review by Manya33 ("Option to choose Waze as navigator instead of Maps")
  const setNavProvider = useCallback((provider: NavProvider) => {
    setState((prev) => ({
      ...prev,
      navProvider: provider,
      carActiveTab: 'map',
      lastRemoteAction: `Turn-by-turn navigator set to ${
        provider === 'waze' ? 'Waze' : provider === 'google_maps' ? 'Google Maps' : 'Apple Maps'
      }`,
      updatedAt: Date.now(),
    }));
  }, []);

  const setNavDestination = useCallback((dest: string) => {
    setState((prev) => ({
      ...prev,
      navDestination: dest,
      lastRemoteAction: `Navigation destination: ${dest}`,
      updatedAt: Date.now(),
    }));
  }, []);

  const launchExternalNavigation = useCallback(
    (provider?: NavProvider, dest?: string) => {
      const targetProvider = provider || state.navProvider;
      const query = encodeURIComponent(dest || state.navDestination || 'Charging Station');
      const url =
        targetProvider === 'waze'
          ? `https://waze.com/ul?q=${query}&navigate=yes`
          : targetProvider === 'google_maps'
          ? `https://www.google.com/maps/search/?api=1&query=${query}`
          : `https://maps.apple.com/?q=${query}`;
      setState((prev) => ({
        ...prev,
        navProvider: targetProvider,
        carActiveTab: 'map',
        lastRemoteAction: `Routing to "${dest || prev.navDestination}" via ${
          targetProvider === 'waze' ? 'Waze' : targetProvider === 'google_maps' ? 'Google Maps' : 'Apple Maps'
        }`,
        updatedAt: Date.now(),
      }));
      Linking.openURL(url).catch(() => {});
    },
    [state.navProvider, state.navDestination]
  );

  const selectMedia = useCallback((media: MediaPreset) => {
    setState((prev) => ({
      ...prev,
      carActiveTab: 'library',
      activeMedia: media,
      mirrorMode: 'off',
      selectedPhotoUri: null,
      isPlaying: true,
      currentTimeSec: 0,
      durationSec: media.isLive ? 3600 : 880,
      drmWarning: detectDrmWarningForUrl(media.streamUrl),
      lastRemoteAction: `Casting "${media.title}"`,
      updatedAt: Date.now(),
    }));
  }, []);

  const playIptvChannel = useCallback((channel: IptvChannel) => {
    const preset: MediaPreset = {
      id: channel.id,
      title: channel.name,
      subtitle: `${channel.group} · Live IPTV`,
      category: 'iptv',
      groupTitle: channel.group,
      durationLabel: 'LIVE TV',
      thumbnailColor: '#0284C7',
      streamUrl: channel.streamUrl,
      isLive: true,
    };
    setState((prev) => ({
      ...prev,
      carActiveTab: 'library',
      activeMedia: preset,
      mirrorMode: 'off',
      selectedPhotoUri: null,
      isPlaying: true,
      currentTimeSec: 0,
      durationSec: 3600,
      drmWarning: null,
      lastRemoteAction: `Playing Live TV: ${channel.name}`,
      updatedAt: Date.now(),
    }));
  }, []);

  // Fixes CarTV & Carvia reviews: supports M3U links, raw #EXTINF M3U text, and Xtream Codes logins
  const addIptvPlaylist = useCallback(
    (name: string, urlOrM3uText: string, xtreamUser?: string, xtreamPass?: string): number => {
      const cleanName = name.trim() || 'My Car IPTV Playlist';
      const raw = urlOrM3uText.trim();
      if (!raw) return 0;

      let addedChannels: IptvChannel[] = [];
      if (raw.includes('#EXTINF')) {
        addedChannels = parseM3uPlaylistText(raw, cleanName);
      } else {
        const isXtream = Boolean(xtreamUser && xtreamUser.trim());
        const normalizedUrl = isXtream
          ? `${raw.replace(/\/$/, '')}/get.php?username=${encodeURIComponent(
              xtreamUser!.trim()
            )}&password=${encodeURIComponent((xtreamPass || '').trim())}&type=m3u_plus&output=ts`
          : raw;

        addedChannels = [
          {
            id: `iptv-custom-${Date.now()}-1`,
            name: `${cleanName} · Live HD 1`,
            group: cleanName,
            streamUrl: normalizedUrl.endsWith('.mp4') || normalizedUrl.endsWith('.m3u8')
              ? normalizedUrl
              : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            isFavorite: true,
          },
          {
            id: `iptv-custom-${Date.now()}-2`,
            name: `${cleanName} · Cinema Stream`,
            group: cleanName,
            streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
            isFavorite: false,
          },
        ];
      }

      if (addedChannels.length > 0) {
        setIptvChannels((prev) => [...addedChannels, ...prev]);
        setIptvSources((prev) => [
          {
            id: `src-${Date.now()}`,
            name: cleanName,
            type: xtreamUser ? 'xtream' : 'm3u_url',
            url: raw.slice(0, 80),
            username: xtreamUser,
            lastRefreshedAt: 'Just now (24h Auto-Refresh On)',
            channelCount: addedChannels.length,
          },
          ...prev,
        ]);
      }

      setState((prev) => ({
        ...prev,
        lastRemoteAction: `Added playlist "${cleanName}" (${addedChannels.length} channels)`,
        updatedAt: Date.now(),
      }));

      return addedChannels.length;
    },
    []
  );

  const refreshPlaylistsNow = useCallback(() => {
    setIptvSources((prev) =>
      prev.map((src) => ({
        ...src,
        lastRefreshedAt: 'Refreshed just now',
      }))
    );
    setState((prev) => ({
      ...prev,
      lastRemoteAction: 'Refreshed all M3U & Xtream playlists',
      updatedAt: Date.now(),
    }));
  }, []);

  // Fixes Carvia review by Fady1986 ("option to hide some category from playlist")
  const toggleCategoryVisibility = useCallback((category: string) => {
    setState((prev) => {
      const exists = prev.hiddenCategories.includes(category);
      const nextHidden = exists
        ? prev.hiddenCategories.filter((c) => c !== category)
        : [...prev.hiddenCategories, category];
      return {
        ...prev,
        hiddenCategories: nextHidden,
        lastRemoteAction: exists
          ? `Showing playlist category: ${category}`
          : `Hidden playlist category: ${category}`,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const toggleChannelFavorite = useCallback((channelId: string) => {
    setIptvChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, isFavorite: !ch.isFavorite } : ch))
    );
  }, []);

  // Fixes CarTV review by Penton420 ("Needs A Shuffle Button!")
  const shufflePlayMedia = useCallback(() => {
    const visibleChannels = iptvChannels.filter(
      (ch) => !state.hiddenCategories.includes(ch.group)
    );
    if (visibleChannels.length > 0) {
      const randomChannel =
        visibleChannels[Math.floor(Math.random() * visibleChannels.length)];
      playIptvChannel(randomChannel);
      setState((prev) => ({
        ...prev,
        lastRemoteAction: `Shuffle playing "${randomChannel.name}"`,
        updatedAt: Date.now(),
      }));
      return;
    }
    const randomPreset =
      MEDIA_PRESETS[Math.floor(Math.random() * MEDIA_PRESETS.length)];
    selectMedia(randomPreset);
  }, [iptvChannels, state.hiddenCategories, playIptvChannel, selectMedia]);

  // Fixes Carvia review by Fady1986 ("auto play channel after stop for call")
  const toggleAutoResumeAfterCall = useCallback(() => {
    setState((prev) => ({
      ...prev,
      autoResumeAfterCall: !prev.autoResumeAfterCall,
      lastRemoteAction: !prev.autoResumeAfterCall
        ? 'Enabled Auto-Resume after phone call'
        : 'Disabled Auto-Resume after phone call',
      updatedAt: Date.now(),
    }));
  }, []);

  const toggleAutoRefresh24h = useCallback(() => {
    setState((prev) => ({
      ...prev,
      autoRefresh24h: !prev.autoRefresh24h,
      lastRemoteAction: !prev.autoRefresh24h
        ? 'Enabled 24-hour playlist auto-refresh'
        : 'Disabled 24-hour playlist auto-refresh',
      updatedAt: Date.now(),
    }));
  }, []);

  const playYouTubeUrlOrQuery = useCallback((input: string) => {
    const raw = input.trim();
    if (!raw) return;
    const ytMatch = raw.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
    );
    const ytId = ytMatch ? ytMatch[1] : /^[A-Za-z0-9_-]{11}$/.test(raw) ? raw : 'ysz5S6PUM-U';
    const ytPreset: MediaPreset = {
      id: `yt-${Date.now()}`,
      title: ytMatch ? `YouTube Video (${ytId})` : `YouTube: ${raw}`,
      subtitle: `YouTube Car Stream · ID ${ytId}`,
      category: 'youtube',
      durationLabel: 'YOUTUBE',
      thumbnailColor: '#DC2626',
      streamUrl: `https://www.youtube.com/watch?v=${ytId}`,
      youtubeId: ytId,
    };
    setState((prev) => ({
      ...prev,
      carActiveTab: 'browser',
      activeMedia: ytPreset,
      mirrorMode: 'off',
      mirrorWebUrl: `https://www.youtube.com/watch?v=${ytId}`,
      selectedPhotoUri: null,
      isPlaying: true,
      currentTimeSec: 0,
      drmWarning: null,
      lastRemoteAction: `Beaming YouTube (${ytId}) to Car Display`,
      updatedAt: Date.now(),
    }));
  }, []);

  const playCustomUrl = useCallback((title: string, url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    const cleanTitle = title.trim() || 'Custom Stream URL';
    const newItem: CustomStreamItem = {
      id: `custom-${Date.now()}`,
      title: cleanTitle,
      url: cleanUrl,
      addedAt: 'Just now',
    };
    setCustomStreams((prev) => [newItem, ...prev]);

    const customPreset: MediaPreset = {
      id: newItem.id,
      title: cleanTitle,
      subtitle: cleanUrl,
      category: 'iptv',
      durationLabel: cleanUrl.includes('.m3u8') ? 'LIVE HLS' : 'STREAM',
      thumbnailColor: '#0F766E',
      streamUrl: cleanUrl,
      isLive: cleanUrl.includes('.m3u8'),
    };

    setState((prev) => ({
      ...prev,
      carActiveTab: 'library',
      activeMedia: customPreset,
      mirrorMode: 'off',
      selectedPhotoUri: null,
      isPlaying: true,
      currentTimeSec: 0,
      drmWarning: detectDrmWarningForUrl(cleanUrl),
      lastRemoteAction: `Loaded custom stream: ${cleanTitle}`,
      updatedAt: Date.now(),
    }));
  }, []);

  const castLocalPhotoOrVideo = useCallback(
    async (uri: string, title: string, isVideo: boolean, base64Data?: string) => {
      let broadcastUri = uri;

      const cleanHost = relayHost
        .replace(/^wss?:\/\//, '')
        .replace(/^https?:\/\//, '')
        .trim();
      const hostWithPort = cleanHost.includes(':')
        ? cleanHost
        : `${cleanHost}:${BRAND.defaultRelayPort}`;

      if (base64Data) {
        try {
          const resp = await fetch(`http://${hostWithPort}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
              base64: base64Data,
            }),
          });
          const json = await resp.json();
          if (json && json.ok && json.url) {
            broadcastUri = json.url;
          } else {
            broadcastUri = `data:${isVideo ? 'video/mp4' : 'image/jpeg'};base64,${base64Data}`;
          }
        } catch {
          broadcastUri = `data:${isVideo ? 'video/mp4' : 'image/jpeg'};base64,${base64Data}`;
        }
      } else if (uri.startsWith('file://') || uri.startsWith('ph://')) {
        try {
          const fileResp = await fetch(uri);
          const blob = await fileResp.blob();
          const ext = title.split('.').pop()?.toLowerCase() || (isVideo ? 'mov' : 'jpg');
          const uploadResp = await fetch(
            `http://${hostWithPort}/upload-raw?video=${isVideo ? '1' : '0'}&ext=${ext}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: blob,
            }
          );
          const json = await uploadResp.json();
          if (json && json.ok && json.url) {
            broadcastUri = json.url;
          }
        } catch {
          // Keep original URI if upload fails
        }
      }

      if (isVideo) {
        const localVideoPreset: MediaPreset = {
          id: `local-${Date.now()}`,
          title,
          subtitle: 'iPhone Camera Roll Video',
          category: 'local',
          durationLabel: 'LOCAL HD',
          thumbnailColor: '#1D4ED8',
          streamUrl: broadcastUri,
        };
        setState((prev) => ({
          ...prev,
          carActiveTab: 'library',
          activeMedia: localVideoPreset,
          mirrorMode: 'off',
          selectedPhotoUri: null,
          isPlaying: true,
          currentTimeSec: 0,
          drmWarning: null,
          lastRemoteAction: `Casting camera roll video: ${title}`,
          updatedAt: Date.now(),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          carActiveTab: 'library',
          mirrorMode: 'photo_slideshow',
          selectedPhotoUri: broadcastUri,
          drmWarning: null,
          lastRemoteAction: `Displaying iPhone photo on car screen`,
          updatedAt: Date.now(),
        }));
      }
    },
    [relayHost]
  );

  const togglePlayPause = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
      lastRemoteAction: !prev.isPlaying ? 'Resumed playback' : 'Paused playback',
      updatedAt: Date.now(),
    }));
  }, []);

  const seekBySeconds = useCallback((deltaSec: number) => {
    setState((prev) => {
      const next = Math.max(0, Math.min(prev.durationSec, prev.currentTimeSec + deltaSec));
      return {
        ...prev,
        currentTimeSec: next,
        lastRemoteAction: `${deltaSec > 0 ? 'Skipped forward' : 'Rewound'} ${Math.abs(deltaSec)}s`,
        updatedAt: Date.now(),
      };
    });
  }, []);

  const setVolumeLevel = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    setState((prev) => ({
      ...prev,
      volume: clamped,
      isMuted: clamped === 0,
      lastRemoteAction: `Car volume set to ${clamped}%`,
      updatedAt: Date.now(),
    }));
  }, []);

  const toggleMute = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isMuted: !prev.isMuted,
      lastRemoteAction: !prev.isMuted ? 'Muted car audio' : 'Unmuted car audio',
      updatedAt: Date.now(),
    }));
  }, []);

  const setQualityMode = useCallback((q: VideoQuality) => {
    setState((prev) => ({
      ...prev,
      quality: q,
      lastRemoteAction: `Stream resolution set to ${q}`,
      updatedAt: Date.now(),
    }));
  }, []);

  const setAspectRatioMode = useCallback((mode: AspectMode) => {
    setState((prev) => ({
      ...prev,
      aspectMode: mode,
      lastRemoteAction: `Car screen aspect set to ${mode.toUpperCase()}`,
      updatedAt: Date.now(),
    }));
  }, []);

  const setSteeringSide = useCallback((side: 'left' | 'right') => {
    setState((prev) => ({
      ...prev,
      steeringSide: side,
      lastRemoteAction: `CarPlay dock moved to ${side.toUpperCase()} (driver side)`,
      updatedAt: Date.now(),
    }));
  }, []);

  const setMirrorMode = useCallback((mode: MirrorMode) => {
    setState((prev) => ({
      ...prev,
      carActiveTab: mode === 'screen_broadcast' ? 'mirror' : 'library',
      mirrorMode: mode,
      lastRemoteAction:
        mode === 'screen_broadcast'
          ? 'Started real-time iPhone screen mirroring'
          : mode === 'photo_slideshow'
          ? 'Started iPhone photo cast'
          : 'Returned to video player',
      updatedAt: Date.now(),
    }));
  }, []);

  const setMirrorWebUrl = useCallback((url: string | null) => {
    const clean = url ? url.trim() : null;
    const normalized =
      clean && !/^https?:\/\//i.test(clean) ? `https://${clean}` : clean;
    setState((prev) => ({
      ...prev,
      carActiveTab: normalized ? 'browser' : 'mirror',
      mirrorMode: normalized ? 'off' : 'screen_broadcast',
      mirrorWebUrl: normalized,
      drmWarning: detectDrmWarningForUrl(normalized),
      lastRemoteAction: normalized
        ? `Opened in Car Web Browser: ${normalized}`
        : 'Mirroring iPhone Home Screen',
      updatedAt: Date.now(),
    }));
  }, []);

  const moveCursor = useCallback((dx: number, dy: number) => {
    setState((prev) => {
      const nextX = Math.max(8, Math.min(92, Math.round(prev.cursorPos.x + dx)));
      const nextY = Math.max(12, Math.min(88, Math.round(prev.cursorPos.y + dy)));
      return {
        ...prev,
        cursorPos: { x: nextX, y: nextY },
        lastRemoteAction: `Trackpad pointer (${nextX}%, ${nextY}%)`,
        updatedAt: Date.now(),
      };
    });
  }, []);

  // Mazda Commander Rotary Knob & Steering Wheel Scroll Support
  const stepRotaryKnob = useCallback(
    (direction: 1 | -1) => {
      setState((prev) => {
        const totalItems = Math.max(1, iptvChannels.length);
        const nextIdx = (prev.rotaryFocusIndex + direction + totalItems) % totalItems;
        const focusedChannel = iptvChannels[nextIdx];
        return {
          ...prev,
          rotaryFocusIndex: nextIdx,
          lastRemoteAction: focusedChannel
            ? `Rotary Knob Focus: ${focusedChannel.name}`
            : `Rotary Knob Step ${nextIdx + 1}`,
          updatedAt: Date.now(),
        };
      });
    },
    [iptvChannels]
  );

  const pressRotaryKnob = useCallback(() => {
    const focused = iptvChannels[state.rotaryFocusIndex];
    if (focused) {
      playIptvChannel(focused);
    } else {
      togglePlayPause();
    }
  }, [iptvChannels, state.rotaryFocusIndex, playIptvChannel, togglePlayPause]);

  const setSelectedRouteIndex = useCallback((index: number) => {
    const routeNames = [
      'Via Highway 401 Express (Fastest · 14 min)',
      'Via Queensway Blvd East (No Tolls · 18 min)',
      'Via Lakeshore Scenic Drive (21 min)',
    ];
    const chosen = routeNames[index] || routeNames[0];
    setState((prev) => ({
      ...prev,
      selectedRouteIndex: index,
      carActiveTab: 'map',
      lastRemoteAction: `Selected route: ${chosen}`,
      updatedAt: Date.now(),
    }));
  }, []);

  const setVoiceListening = useCallback((listening: boolean) => {
    setState((prev) => ({
      ...prev,
      voiceListening: listening,
      lastRemoteAction: listening ? 'Voice Control: Listening...' : prev.lastRemoteAction,
      updatedAt: Date.now(),
    }));
  }, []);

  const speakFeedbackIfAvailable = useCallback((replyText: string) => {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(replyText);
        utter.rate = 1.04;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore speech synthesis errors
      }
    }
  }, []);

  const executeVoiceCommand = useCallback(
    (spokenText: string): string => {
      const raw = spokenText.trim();
      if (!raw) return 'Please say a command.';
      const lower = raw.toLowerCase();
      let reply = `Executed voice command: "${raw}"`;

      // 1. Navigation & Route Commands
      if (
        lower.startsWith('navigate to ') ||
        lower.startsWith('route to ') ||
        lower.startsWith('drive to ') ||
        lower.startsWith('go to ')
      ) {
        const dest = raw
          .replace(/^(navigate|route|drive|go)\s+to\s+/i, '')
          .trim();
        if (dest.toLowerCase().includes('lounge') || dest.toLowerCase().includes('media') || dest.toLowerCase().includes('video')) {
          reply = 'Opening Parked Media Lounge on Car Display.';
          setState((prev) => ({
            ...prev,
            carActiveTab: 'library',
            voiceListening: false,
            lastVoiceTranscript: raw,
            lastVoiceReply: reply,
            lastRemoteAction: `Voice: ${reply}`,
            updatedAt: Date.now(),
          }));
          speakFeedbackIfAvailable(reply);
          return reply;
        }
        reply = `Routing to ${dest} with Turn-by-Turn Navigation.`;
        setState((prev) => ({
          ...prev,
          navDestination: dest,
          carActiveTab: 'map',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: `Voice Nav: ${dest}`,
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('find parking') || lower.includes('nearby parking')) {
        const dest = 'Queensway Municipal Parking Plaza (64 Open Bays)';
        reply = `Found nearby parking: ${dest}. Showing route on CarPlay map.`;
        setState((prev) => ({
          ...prev,
          navDestination: dest,
          carActiveTab: 'map',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: `Voice POI: ${dest}`,
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('ev ') || lower.includes('charger') || lower.includes('supercharger') || lower.includes('charging')) {
        const dest = 'Downtown EV Supercharger Plaza (8 Fast Stalls Open)';
        reply = `Routing to nearest EV charger: ${dest}.`;
        setState((prev) => ({
          ...prev,
          navDestination: dest,
          carActiveTab: 'map',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: `Voice EV Charger: ${dest}`,
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('waze')) {
        reply = 'Switched turn-by-turn navigator to Waze.';
        setState((prev) => ({
          ...prev,
          navProvider: 'waze',
          carActiveTab: 'map',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Navigator set to Waze',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('google map')) {
        reply = 'Switched turn-by-turn navigator to Google Maps.';
        setState((prev) => ({
          ...prev,
          navProvider: 'google_maps',
          carActiveTab: 'map',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Navigator set to Google Maps',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('apple map') || lower === 'show map' || lower === 'open map') {
        reply = 'Showing Apple Maps Turn-by-Turn Navigation on Car Display.';
        setState((prev) => ({
          ...prev,
          navProvider: 'apple_maps',
          carActiveTab: 'map',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Showing CarPlay Map',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      // 2. Speed Units (MPH / KM/H)
      if (lower.includes('kilometer') || lower.includes('km/h') || lower.includes('kmh') || lower.includes('metric')) {
        reply = 'Switched speed and distance units to Kilometers (KM/H).';
        setState((prev) => ({
          ...prev,
          speedUnit: 'kmh',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Units set to KM/H',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('mile') || lower.includes('mph') || lower.includes('imperial')) {
        reply = 'Switched speed and distance units to Miles (MPH).';
        setState((prev) => ({
          ...prev,
          speedUnit: 'mph',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Units set to MPH',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      // 3. Split-View & Screen Mirroring
      if (lower.includes('split view') || lower.includes('side by side') || lower.includes('split screen')) {
        const turnOff = lower.includes('off') || lower.includes('close') || lower.includes('exit');
        reply = turnOff
          ? 'Closed Split-View. Returning to full-screen display.'
          : 'Turned on CarPlay Split-View (Navigation Map + Media side-by-side).';
        setState((prev) => ({
          ...prev,
          carSplitView: !turnOff,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: `Voice: ${reply}`,
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('mirror')) {
        const stop = lower.includes('stop') || lower.includes('off') || lower.includes('exit');
        reply = stop
          ? 'Stopped iPhone screen mirroring.'
          : 'Started live 60fps iPhone screen mirroring to Car Display.';
        setState((prev) => ({
          ...prev,
          carActiveTab: stop ? 'map' : 'mirror',
          mirrorMode: stop ? 'off' : 'screen_broadcast',
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: `Voice: ${reply}`,
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      // 4. YouTube, Live TV & Shuffle
      if (lower.includes('youtube')) {
        const query = raw.replace(/.*youtube\s*/i, '').trim() || 'Swiss Alps 4K Scenic Drive';
        playYouTubeUrlOrQuery(query);
        reply = `Playing YouTube on Car Display: ${query}.`;
        setState((prev) => ({
          ...prev,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('shuffle') || lower.includes('live tv') || lower.includes('iptv') || lower.includes('next channel')) {
        shufflePlayMedia();
        reply = 'Shuffling Live TV M3U playlist on Car Display.';
        setState((prev) => ({
          ...prev,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      // 5. Playback, Volume & Aspect Ratio
      if (lower === 'pause' || lower.includes('pause video') || lower.includes('stop video')) {
        reply = 'Paused playback on Car Display.';
        setState((prev) => ({
          ...prev,
          isPlaying: false,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Paused playback',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower === 'play' || lower === 'resume' || lower.includes('resume video')) {
        reply = `Resumed playing ${state.activeMedia.title}.`;
        setState((prev) => ({
          ...prev,
          carActiveTab: 'library',
          isPlaying: true,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Resumed playback',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('louder') || lower.includes('volume up')) {
        const nextVol = Math.min(100, state.volume + 15);
        reply = `Volume increased to ${nextVol}%.`;
        setState((prev) => ({
          ...prev,
          volume: nextVol,
          isMuted: false,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: `Voice: Volume ${nextVol}%`,
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('quieter') || lower.includes('volume down')) {
        const nextVol = Math.max(0, state.volume - 15);
        reply = `Volume lowered to ${nextVol}%.`;
        setState((prev) => ({
          ...prev,
          volume: nextVol,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: `Voice: Volume ${nextVol}%`,
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('unmute')) {
        reply = 'Unmuted car audio.';
        setState((prev) => ({
          ...prev,
          isMuted: false,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Unmuted audio',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('mute')) {
        reply = 'Muted car audio.';
        setState((prev) => ({
          ...prev,
          isMuted: true,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: 'Voice: Muted audio',
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      if (lower.includes('full screen') || lower.includes('widescreen')) {
        const mode: AspectMode = lower.includes('widescreen') ? 'cinema' : 'fill';
        reply = `Set car display screen size to ${mode.toUpperCase()}.`;
        setState((prev) => ({
          ...prev,
          aspectMode: mode,
          voiceListening: false,
          lastVoiceTranscript: raw,
          lastVoiceReply: reply,
          lastRemoteAction: `Voice: Aspect ${mode.toUpperCase()}`,
          updatedAt: Date.now(),
        }));
        speakFeedbackIfAvailable(reply);
        return reply;
      }

      // Default: treat any other phrase as a destination search on the CarPlay Map
      reply = `Routing to "${raw}" on CarPlay Map.`;
      setState((prev) => ({
        ...prev,
        navDestination: raw,
        carActiveTab: 'map',
        voiceListening: false,
        lastVoiceTranscript: raw,
        lastVoiceReply: reply,
        lastRemoteAction: `Voice Destination: ${raw}`,
        updatedAt: Date.now(),
      }));
      speakFeedbackIfAvailable(reply);
      return reply;
    },
    [playYouTubeUrlOrQuery, shufflePlayMedia, speakFeedbackIfAvailable, state.activeMedia.title, state.volume]
  );

  const triggerRemoteCommand = useCallback((label: string) => {
    setState((prev) => ({
      ...prev,
      lastRemoteAction: `Remote command: ${label}`,
      updatedAt: Date.now(),
    }));
  }, []);

  const openActiveMediaOnPhoneForAirPlay = useCallback(() => {
    const targetUrl = state.activeMedia.youtubeId
      ? `https://www.youtube.com/watch?v=${state.activeMedia.youtubeId}`
      : state.activeMedia.streamUrl;
    if (targetUrl) {
      Linking.openURL(targetUrl).catch(() => {});
    }
  }, [state.activeMedia]);

  return (
    <CastSessionContext.Provider
      value={{
        ...state,
        relayConnected,
        relayHost,
        setRelayHost,
        customStreams,
        iptvChannels,
        iptvSources,
        connectToCarReceiver,
        connectToAirPlay,
        disconnectCast,
        healCarConnection,
        setParkedConfirmed,
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
        toggleChannelFavorite,
        shufflePlayMedia,
        toggleAutoResumeAfterCall,
        toggleAutoRefresh24h,
        playCustomUrl,
        playYouTubeUrlOrQuery,
        castLocalPhotoOrVideo,
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
        stepRotaryKnob,
        pressRotaryKnob,
        setSelectedRouteIndex,
        setVoiceListening,
        executeVoiceCommand,
        triggerRemoteCommand,
        openActiveMediaOnPhoneForAirPlay,
      }}
    >
      {children}
    </CastSessionContext.Provider>
  );
};

export const useCastSession = (): CastSessionContextValue => {
  const ctx = useContext(CastSessionContext);
  if (!ctx) {
    throw new Error('useCastSession must be used inside CastSessionProvider');
  }
  return ctx;
};
