import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadArray, saveJson } from '../lib/storage';
import { parseM3u, type M3uChannel } from '../lib/m3u';
import type { PlaceResult } from '../native/ParkCastNative';

export type MediaKind = 'video' | 'photo' | 'slideshow' | 'web';

export interface LibraryItem {
  id: string;
  kind: MediaKind;
  title: string;
  subtitle?: string;
  uri: string;
  items?: string[];
  addedAt: number;
}

export interface PlaylistSource {
  id: string;
  name: string;
  url: string;
  channels: M3uChannel[];
  updatedAt: number;
}

const RECENTS_KEY = 'parkcast.recents.v2';
const SOURCES_KEY = 'parkcast.sources.v2';
const PLACES_KEY = 'parkcast.places.v2';
const MAX_RECENTS = 30;
const MAX_PLACES = 10;
const MAX_CHANNELS = 3000;

interface LibraryContextValue {
  recents: LibraryItem[];
  sources: PlaylistSource[];
  places: PlaceResult[];
  addRecent: (item: Omit<LibraryItem, 'id' | 'addedAt'> & { id?: string }) => LibraryItem;
  removeRecent: (id: string) => void;
  clearRecents: () => void;
  addSource: (name: string, url: string) => Promise<PlaylistSource>;
  refreshSource: (id: string) => Promise<void>;
  removeSource: (id: string) => void;
  addPlace: (place: PlaceResult) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

async function downloadChannels(url: string, sourceId: string): Promise<M3uChannel[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`The playlist server answered ${response.status}.`);
  const channels = parseM3u(await response.text(), sourceId).slice(0, MAX_CHANNELS);
  if (!channels.length) throw new Error('No channels were found in this playlist.');
  return channels;
}

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [recents, setRecents] = useState<LibraryItem[]>([]);
  const [sources, setSources] = useState<PlaylistSource[]>([]);
  const [places, setPlaces] = useState<PlaceResult[]>([]);

  useEffect(() => {
    loadArray<LibraryItem>(RECENTS_KEY).then(setRecents);
    loadArray<PlaylistSource>(SOURCES_KEY).then(setSources);
    loadArray<PlaceResult>(PLACES_KEY).then(setPlaces);
  }, []);

  const addRecent = useCallback<LibraryContextValue['addRecent']>((input) => {
    const item: LibraryItem = { ...input, id: input.id ?? makeId(), addedAt: Date.now() };
    setRecents((previous) => {
      const next = [item, ...previous.filter((existing) => existing.uri !== item.uri || existing.kind !== item.kind)].slice(
        0,
        MAX_RECENTS
      );
      saveJson(RECENTS_KEY, next);
      return next;
    });
    return item;
  }, []);

  const removeRecent = useCallback((id: string) => {
    setRecents((previous) => {
      const next = previous.filter((item) => item.id !== id);
      saveJson(RECENTS_KEY, next);
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    saveJson(RECENTS_KEY, []);
  }, []);

  const storeSources = (updater: (previous: PlaylistSource[]) => PlaylistSource[]) => {
    setSources((previous) => {
      const next = updater(previous);
      saveJson(SOURCES_KEY, next);
      return next;
    });
  };

  const addSource = useCallback(async (name: string, url: string) => {
    const id = makeId();
    const channels = await downloadChannels(url.trim(), id);
    const source: PlaylistSource = { id, name: name.trim() || 'My playlist', url: url.trim(), channels, updatedAt: Date.now() };
    storeSources((previous) => [source, ...previous]);
    return source;
  }, []);

  const refreshSource = useCallback(
    async (id: string) => {
      const source = sources.find((entry) => entry.id === id);
      if (!source) return;
      const channels = await downloadChannels(source.url, id);
      storeSources((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, channels, updatedAt: Date.now() } : entry))
      );
    },
    [sources]
  );

  const removeSource = useCallback((id: string) => {
    storeSources((previous) => previous.filter((entry) => entry.id !== id));
  }, []);

  const addPlace = useCallback((place: PlaceResult) => {
    setPlaces((previous) => {
      const next = [
        place,
        ...previous.filter((entry) => entry.latitude !== place.latitude || entry.longitude !== place.longitude),
      ].slice(0, MAX_PLACES);
      saveJson(PLACES_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ recents, sources, places, addRecent, removeRecent, clearRecents, addSource, refreshSource, removeSource, addPlace }),
    [recents, sources, places, addRecent, removeRecent, clearRecents, addSource, refreshSource, removeSource, addPlace]
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider');
  return context;
}
