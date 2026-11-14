import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import {
  isNativeAvailable,
  ParkCastNative,
  type CarCommand,
  type CarMode,
  type PlaceResult,
  type RouteOption,
  type RouteProgress,
} from '../native/ParkCastNative';
import { ENV } from '../config/env';
import { FREE_LIMIT_REACHED } from '../config/brand';
import { fetchWeather, formatWeather, type WeatherNow } from '../lib/weather';
import { greetingFor } from '../lib/format';
import { useSettings, type NavApp } from './SettingsContext';
import { useLibrary, type LibraryItem, type MediaKind } from './LibraryContext';
import { useSubscription } from './SubscriptionContext';

export interface CarMedia {
  kind: MediaKind;
  uri: string;
  title: string;
  items?: string[];
}

export interface PlannedRoute {
  place: PlaceResult;
  options: RouteOption[];
}

export type PlayInput = Omit<LibraryItem, 'id' | 'addedAt'> & { id?: string };

interface CarContextValue {
  nativeAvailable: boolean;
  carConnected: boolean;
  mode: CarMode;
  media: CarMedia | null;
  playing: boolean;
  fill: boolean;
  progress: { position: number; duration: number };
  mirroring: boolean;
  moving: boolean;
  location: { latitude: number; longitude: number } | null;
  locationStatus: 'unknown' | 'granted' | 'denied';
  weather: WeatherNow | null;
  weatherText: string;
  plannedRoute: PlannedRoute | null;
  guidance: RouteProgress | null;
  voiceListening: boolean;
  voiceTranscript: string;
  play: (input: PlayInput) => boolean;
  playLast: () => boolean;
  setMode: (mode: CarMode) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setFill: (fill: boolean) => void;
  seekBy: (seconds: number) => void;
  stop: () => void;
  requestLocation: () => Promise<boolean>;
  searchPlaces: (query: string) => Promise<PlaceResult[]>;
  planRoute: (place: PlaceResult) => Promise<void>;
  startRoute: (index: number) => Promise<void>;
  clearPlannedRoute: () => void;
  endRoute: () => void;
  openInNavApp: (place: PlaceResult, app: NavApp) => void;
  startVoice: (onFinal: (transcript: string) => void) => Promise<void>;
  stopVoice: () => void;
}

const CarContext = createContext<CarContextValue | null>(null);

const STAGE_MODES: CarMode[] = ['video', 'web', 'slideshow', 'mirror'];

export function navAppUrl(place: PlaceResult, app: NavApp): string {
  const ll = `${place.latitude},${place.longitude}`;
  switch (app) {
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`;
    case 'waze':
      return `https://waze.com/ul?ll=${ll}&navigate=yes`;
    default:
      return `http://maps.apple.com/?daddr=${ll}&dirflg=d`;
  }
}

function useWebScreenRelay(enabled: boolean, code: string, payload: Record<string, unknown>) {
  const socketRef = useRef<WebSocket | null>(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    if (!enabled || !ENV.relayWsUrl) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const socket = new WebSocket(ENV.relayWsUrl);
      socketRef.current = socket;
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'join', roomCode: code, role: 'phone' }));
        socket.send(JSON.stringify({ type: 'state_update', roomCode: code, payload: payloadRef.current }));
      };
      socket.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, code]);

  useEffect(() => {
    const socket = socketRef.current;
    if (enabled && socket && socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'state_update', roomCode: code, payload }));
    }
  }, [enabled, code, payload]);
}

export const CarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, update: updateSettings } = useSettings();
  const { recents, places, addRecent, addPlace } = useLibrary();
  const { isPro, freeSecondsLeft, openPaywall, setWatching } = useSubscription();

  const idleMode: CarMode = settings.carHome === 'map' ? 'map' : 'home';
  const initialStatus = ParkCastNative.getStatus();

  const [carConnected, setCarConnected] = useState(initialStatus?.carConnected ?? false);
  const [mode, setModeState] = useState<CarMode>(idleMode);
  const [media, setMedia] = useState<CarMedia | null>(null);
  const [playing, setPlayingState] = useState(true);
  const [fill, setFillState] = useState(false);
  const [progress, setProgress] = useState({ position: 0, duration: 0 });
  const [mirroring, setMirroring] = useState(initialStatus?.mirroring ?? false);
  const [moving, setMoving] = useState(initialStatus?.moving ?? false);
  const [location, setLocation] = useState<CarContextValue['location']>(null);
  const [locationStatus, setLocationStatus] = useState<CarContextValue['locationStatus']>('unknown');
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const [guidance, setGuidance] = useState<RouteProgress | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [greeting, setGreeting] = useState(greetingFor());

  const recentsRef = useRef(recents);
  recentsRef.current = recents;
  const voiceCallback = useRef<((transcript: string) => void) | null>(null);

  const hasFreeTime = isPro || freeSecondsLeft > 0;

  const play = useCallback(
    (input: PlayInput) => {
      if (!hasFreeTime && input.kind !== 'photo') {
        openPaywall(`${FREE_LIMIT_REACHED} Go Premium to keep watching.`);
        return false;
      }
      const item = addRecent(input);
      setMedia({ kind: item.kind, uri: item.uri, title: item.title, items: item.items });
      setModeState(item.kind);
      setPlayingState(true);
      setProgress({ position: 0, duration: 0 });
      return true;
    },
    [addRecent, hasFreeTime, openPaywall]
  );

  const playLast = useCallback(() => {
    const last = recentsRef.current[0];
    return last ? play(last) : false;
  }, [play]);

  const setMode = useCallback(
    (next: CarMode) => {
      if (STAGE_MODES.includes(next) && next !== 'mirror' && !hasFreeTime) {
        openPaywall(`${FREE_LIMIT_REACHED} Go Premium to keep watching.`);
        return;
      }
      setModeState(next);
    },
    [hasFreeTime, openPaywall]
  );

  const stop = useCallback(() => {
    setMedia(null);
    setModeState(idleMode);
    setProgress({ position: 0, duration: 0 });
  }, [idleMode]);

  useEffect(() => {
    setModeState((current) => (current === 'home' || current === 'map') && !media ? idleMode : current);
  }, [idleMode, media]);

  const watching = carConnected && STAGE_MODES.includes(mode) && (mode === 'mirror' ? mirroring : playing && !moving);

  useEffect(() => {
    setWatching(watching);
  }, [watching, setWatching]);

  useEffect(() => {
    if (watching && !hasFreeTime) {
      setPlayingState(false);
      setModeState(idleMode);
      openPaywall(`${FREE_LIMIT_REACHED} Go Premium to keep watching.`);
    }
  }, [watching, hasFreeTime, idleMode, openPaywall]);

  // Native events from the CarPlay scene and system services.
  useEffect(() => {
    const subscriptions = [
      ParkCastNative.on<{ connected: boolean }>('onCarPlayStatus', ({ connected }) => setCarConnected(connected)),
      ParkCastNative.on<{ moving: boolean }>('onParkState', ({ moving: isMoving }) => setMoving(isMoving)),
      ParkCastNative.on<{ position: number; duration: number }>('onPlayerProgress', ({ position, duration }) =>
        setProgress({ position, duration })
      ),
      ParkCastNative.on<{ active: boolean }>('onMirrorStatus', ({ active }) => {
        setMirroring(active);
        if (active) setModeState('mirror');
      }),
      ParkCastNative.on<RouteProgress>('onRouteProgress', (event) => setGuidance(event.active ? event : null)),
      ParkCastNative.on<{ transcript: string; final: boolean }>('onSpeech', ({ transcript, final }) => {
        setVoiceTranscript(transcript);
        if (final) {
          setVoiceListening(false);
          const callback = voiceCallback.current;
          voiceCallback.current = null;
          if (callback && transcript.trim()) callback(transcript.trim());
        }
      }),
      ParkCastNative.on<CarCommand>('onCarCommand', (command) => {
        switch (command.type) {
          case 'mode':
            setModeState(command.mode);
            break;
          case 'playing':
            setPlayingState(command.value);
            break;
          case 'fill':
            setFillState(command.value);
            break;
          case 'ended':
            setPlayingState(false);
            break;
          case 'sleepEnded':
            updateSettings({ sleepMinutes: 0 });
            break;
          case 'playLibraryItem': {
            const item = recentsRef.current.find((entry) => entry.id === command.id);
            if (item) {
              setMedia({ kind: item.kind, uri: item.uri, title: item.title, items: item.items });
              setModeState(item.kind);
              setPlayingState(true);
            }
            break;
          }
          default:
            break;
        }
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [updateSettings]);

  // Location and live weather.
  const refreshPosition = useCallback(async () => {
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!position) return;
    const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    setLocation(coords);
    fetchWeather(ENV.weatherApiUrl, coords.latitude, coords.longitude)
      .then((result) => result && setWeather(result))
      .catch(() => {});
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === Location.PermissionStatus.GRANTED;
      setLocationStatus(granted ? 'granted' : 'denied');
      if (granted) await refreshPosition();
      return granted;
    } catch {
      setLocationStatus('denied');
      return false;
    }
  }, [refreshPosition]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status === Location.PermissionStatus.GRANTED) {
          setLocationStatus('granted');
          refreshPosition().catch(() => {});
          interval = setInterval(() => refreshPosition().catch(() => {}), 10 * 60 * 1000);
        } else if (status === Location.PermissionStatus.DENIED) {
          setLocationStatus('denied');
        }
      })
      .catch(() => {});
    const greetingTimer = setInterval(() => setGreeting(greetingFor()), 60 * 1000);
    return () => {
      if (interval) clearInterval(interval);
      clearInterval(greetingTimer);
    };
  }, [refreshPosition]);

  const weatherText = formatWeather(weather, settings.units);

  // In-memory sync to the CarPlay scene (same process, no network).
  const carState = useMemo(
    () => ({
      mode,
      media,
      playing,
      fill,
      muted: false,
      greeting,
      weather: weatherText,
      settings: {
        units: settings.units,
        glow: settings.glow,
        statusBar: settings.statusBar,
        statusOpacity: settings.statusOpacity,
        parkLock: true,
        sleepMinutes: settings.sleepMinutes,
        mirrorQuality: isPro ? settings.mirrorQuality : 'standard',
      },
      library: recents.slice(0, 20).map(({ id, kind, title, subtitle, uri, items }) => ({
        id,
        kind,
        title,
        subtitle: subtitle ?? '',
        uri,
        items: items ?? [],
      })),
      places,
    }),
    [mode, media, playing, fill, greeting, weatherText, settings, isPro, recents, places]
  );

  useEffect(() => {
    ParkCastNative.sendCarState(carState);
  }, [carState]);

  const webPayload = useMemo(() => {
    const remote = media && /^https?:\/\//i.test(media.uri) ? media : null;
    return { mode, media: remote, localOnly: Boolean(media && !remote), playing, fill, weather: weatherText, greeting };
  }, [mode, media, playing, fill, weatherText, greeting]);
  useWebScreenRelay(settings.webScreen, settings.webScreenCode, webPayload);

  const searchPlaces = useCallback((query: string) => ParkCastNative.searchPlaces(query), []);

  const planRoute = useCallback(async (place: PlaceResult) => {
    const options = await ParkCastNative.getRoutes(place);
    setPlannedRoute({ place, options });
  }, []);

  const openInNavApp = useCallback((place: PlaceResult, app: NavApp) => {
    Linking.openURL(navAppUrl(place, app)).catch(() => {});
  }, []);

  const startRoute = useCallback(
    async (index: number) => {
      if (!plannedRoute) return;
      addPlace(plannedRoute.place);
      if (settings.navApp !== 'parkcast' || !isNativeAvailable) {
        openInNavApp(plannedRoute.place, settings.navApp === 'parkcast' ? 'apple' : settings.navApp);
        setPlannedRoute(null);
        return;
      }
      const started = await ParkCastNative.startNavigation(index);
      if (started) {
        setModeState('map');
        setPlannedRoute(null);
      }
    },
    [plannedRoute, addPlace, settings.navApp, openInNavApp]
  );

  const endRoute = useCallback(() => {
    ParkCastNative.stopNavigation().catch(() => {});
    setGuidance(null);
  }, []);

  const startVoice = useCallback(async (onFinal: (transcript: string) => void) => {
    voiceCallback.current = onFinal;
    setVoiceTranscript('');
    setVoiceListening(true);
    try {
      await ParkCastNative.startListening();
    } catch (error) {
      voiceCallback.current = null;
      setVoiceListening(false);
      throw error;
    }
  }, []);

  const stopVoice = useCallback(() => {
    ParkCastNative.stopListening();
  }, []);

  const value = useMemo<CarContextValue>(
    () => ({
      nativeAvailable: isNativeAvailable,
      carConnected,
      mode,
      media,
      playing,
      fill,
      progress,
      mirroring,
      moving,
      location,
      locationStatus,
      weather,
      weatherText,
      plannedRoute,
      guidance,
      voiceListening,
      voiceTranscript,
      play,
      playLast,
      setMode,
      setPlaying: setPlayingState,
      togglePlay: () => setPlayingState((previous) => !previous),
      setFill: setFillState,
      seekBy: (seconds: number) => ParkCastNative.control('seekBy', seconds),
      stop,
      requestLocation,
      searchPlaces,
      planRoute,
      startRoute,
      clearPlannedRoute: () => setPlannedRoute(null),
      endRoute,
      openInNavApp,
      startVoice,
      stopVoice,
    }),
    [
      carConnected,
      mode,
      media,
      playing,
      fill,
      progress,
      mirroring,
      moving,
      location,
      locationStatus,
      weather,
      weatherText,
      plannedRoute,
      guidance,
      voiceListening,
      voiceTranscript,
      play,
      playLast,
      setMode,
      stop,
      requestLocation,
      searchPlaces,
      planRoute,
      startRoute,
      endRoute,
      openInNavApp,
      startVoice,
      stopVoice,
    ]
  );

  return <CarContext.Provider value={value}>{children}</CarContext.Provider>;
};

export function useCar(): CarContextValue {
  const context = useContext(CarContext);
  if (!context) throw new Error('useCar must be used inside CarProvider');
  return context;
}
