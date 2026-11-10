import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import {
  BRAND,
  MEDIA_PRESETS,
  MediaPreset,
  VideoQuality,
  AspectMode,
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
  lastRemoteAction: string;
  updatedAt: number;
}

export interface CastSessionContextValue extends CastStatePayload {
  relayConnected: boolean;
  relayHost: string;
  setRelayHost: (host: string) => void;
  customStreams: CustomStreamItem[];
  connectToCarReceiver: (code?: string, vehicleName?: string, customRelayHost?: string) => void;
  connectToAirPlay: () => void;
  disconnectCast: () => void;
  setParkedConfirmed: (parked: boolean) => void;
  selectMedia: (media: MediaPreset) => void;
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
  triggerRemoteCommand: (label: string) => void;
  openActiveMediaOnPhoneForAirPlay: () => void;
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
    mirrorWebUrl: null,
    selectedPhotoUri: null,
    cursorPos: { x: 68, y: 36 },
    lastRemoteAction: 'Connected to Car Display (PIN 4829)',
    updatedAt: Date.now(),
  });

  const [relayConnected, setRelayConnected] = useState<boolean>(false);
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

  // Connect to WebSocket relay whenever relayHost or roomCode changes
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
  }, [relayHost, state.roomCode]);

  // Broadcast state updates to paired Car Screen over WebSocket relay
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
  }, [state]);

  // Advance playback clock while playing
  useEffect(() => {
    if (!state.isPlaying || state.connectionTarget === 'disconnected') return;
    const timer = setInterval(() => {
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

  const selectMedia = useCallback((media: MediaPreset) => {
    setState((prev) => ({
      ...prev,
      activeMedia: media,
      mirrorMode: 'off',
      selectedPhotoUri: null,
      isPlaying: true,
      currentTimeSec: 0,
      durationSec: media.isLive ? 3600 : 880,
      lastRemoteAction: `Casting "${media.title}"`,
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
      activeMedia: ytPreset,
      mirrorMode: 'off',
      selectedPhotoUri: null,
      isPlaying: true,
      currentTimeSec: 0,
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
      activeMedia: customPreset,
      mirrorMode: 'off',
      selectedPhotoUri: null,
      isPlaying: true,
      currentTimeSec: 0,
      lastRemoteAction: `Loaded custom stream: ${cleanTitle}`,
      updatedAt: Date.now(),
    }));
  }, []);

  const castLocalPhotoOrVideo = useCallback(
    async (uri: string, title: string, isVideo: boolean, base64Data?: string) => {
      let broadcastUri = uri;

      // If picked from iPhone Camera Roll with base64 data, upload to the laptop relay server
      // so the Car Screen Receiver browser can render the actual photo/video over Wi-Fi
      if (base64Data) {
        const cleanHost = relayHost
          .replace(/^ws:\/\//, '')
          .replace(/^http:\/\//, '')
          .trim();
        const hostWithPort = cleanHost.includes(':')
          ? cleanHost
          : `${cleanHost}:${BRAND.defaultRelayPort}`;
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
          activeMedia: localVideoPreset,
          mirrorMode: 'off',
          selectedPhotoUri: null,
          isPlaying: true,
          currentTimeSec: 0,
          lastRemoteAction: `Casting camera roll video: ${title}`,
          updatedAt: Date.now(),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          mirrorMode: 'photo_slideshow',
          selectedPhotoUri: broadcastUri,
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
      mirrorMode: 'screen_broadcast',
      mirrorWebUrl: normalized,
      lastRemoteAction: normalized
        ? `Mirroring live view: ${normalized}`
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
        lastRemoteAction: `Touchpad cursor (${nextX}%, ${nextY}%)`,
        updatedAt: Date.now(),
      };
    });
  }, []);

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
        connectToCarReceiver,
        connectToAirPlay,
        disconnectCast,
        setParkedConfirmed,
        selectMedia,
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
