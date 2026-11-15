import { useEffect, useRef, useState } from 'react';
import { ParkCastNative, isNativeAvailable, type PlaceSuggestion } from '../native/ParkCastNative';
import { parseSmartSearch } from '../lib/smartSearch';
import { normalizeSuggestions, suggestionQuery, SUGGEST_DEBOUNCE_MS } from '../lib/places';

/** Apple Maps style suggestions that update as the user types. */
export function usePlaceSuggestions(raw: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const query = enabled ? suggestionQuery(parseSmartSearch(raw), raw) : null;

  useEffect(() => {
    const request = ++latest.current;
    if (!query || !isNativeAvailable) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      ParkCastNative.suggestPlaces(query)
        .then((items) => {
          if (request === latest.current) setSuggestions(normalizeSuggestions(items));
        })
        .catch(() => {
          if (request === latest.current) setSuggestions([]);
        })
        .finally(() => {
          if (request === latest.current) setLoading(false);
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  return { query, suggestions, loading };
}
