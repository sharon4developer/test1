import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ParkCastNative } from '../native/ParkCastNative';
import { loadJson, saveJson } from '../lib/storage';
import type { Units } from '../lib/format';

export type NavApp = 'parkcast' | 'apple' | 'google' | 'waze';

export interface Settings {
  onboarded: boolean;
  units: Units;
  carHome: 'clock' | 'map';
  glow: boolean;
  statusBar: boolean;
  statusOpacity: number;
  sleepMinutes: number;
  mirrorQuality: 'standard' | 'hd';
  navApp: NavApp;
  browserAdBlock: boolean;
  webScreen: boolean;
  webScreenCode: string;
}

const STORAGE_KEY = 'parkcast.settings.v2';

function defaultUnits(): Units {
  const status = ParkCastNative.getStatus();
  if (status) return status.usesMetric ? 'kmh' : 'mph';
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return /-(US|GB|LR|MM)$/i.test(navigator.language) ? 'mph' : 'kmh';
  }
  return 'kmh';
}

export function newScreenCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const DEFAULTS: Settings = {
  onboarded: false,
  units: defaultUnits(),
  carHome: 'clock',
  glow: true,
  statusBar: true,
  statusOpacity: 0.85,
  sleepMinutes: 0,
  mirrorQuality: 'standard',
  navApp: 'parkcast',
  browserAdBlock: true,
  webScreen: false,
  webScreenCode: newScreenCode(),
};

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJson(STORAGE_KEY, DEFAULTS).then((stored) => {
      setSettings(stored);
      setReady(true);
    });
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      saveJson(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
