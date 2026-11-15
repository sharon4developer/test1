export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface SuggestionLike {
  id: string;
  title: string;
  subtitle: string;
  isQuery: boolean;
}

export const SUGGEST_DEBOUNCE_MS = 250;
export const MIN_SUGGEST_LENGTH = 2;

const isCoordinate = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Native routes send [latitude, longitude] pairs; the map wants objects. Bad points are dropped. */
export function toLatLngs(coordinates: ReadonlyArray<ReadonlyArray<number>> | undefined): LatLng[] {
  if (!coordinates) return [];
  return coordinates
    .filter((pair) => Array.isArray(pair) && pair.length >= 2 && isCoordinate(pair[0], pair[1]))
    .map(([latitude, longitude]) => ({ latitude, longitude }));
}

/** Smallest map region showing every point, with breathing room around the edges. */
export function regionForPoints(points: LatLng[], padding = 1.35, minDelta = 0.01): Region | null {
  const valid = points.filter((point) => isCoordinate(point.latitude, point.longitude));
  if (!valid.length) return null;
  let minLat = valid[0].latitude;
  let maxLat = minLat;
  let minLng = valid[0].longitude;
  let maxLng = minLng;
  for (const { latitude, longitude } of valid) {
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(minDelta, (maxLat - minLat) * padding),
    longitudeDelta: Math.max(minDelta, (maxLng - minLng) * padding),
  };
}

/** Which text, if any, should get live place suggestions. Links and app commands don't. */
export function suggestionQuery(intent: { type: string; query?: string }, raw: string): string | null {
  if (intent.type !== 'search' && intent.type !== 'navigate') return null;
  const text = (intent.type === 'navigate' && intent.query ? intent.query : raw).trim();
  return text.length >= MIN_SUGGEST_LENGTH ? text : null;
}

/** Drops blanks and duplicates the way Apple Maps does, and caps the list. */
export function normalizeSuggestions<T extends SuggestionLike>(items: T[] | null | undefined, limit = 8): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const title = item?.title?.trim();
    if (!title) continue;
    const key = `${title.toLowerCase()}|${(item.subtitle ?? '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
