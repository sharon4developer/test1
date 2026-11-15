export type SmartCommand =
  | 'mirror'
  | 'library'
  | 'memories'
  | 'settings'
  | 'play'
  | 'pause'
  | 'stop'
  | 'playLast'
  | 'home'
  | 'map'
  | 'fill'
  | 'fit'
  | 'unitsKmh'
  | 'unitsMph'
  | 'endRoute'
  | 'premium'
  | 'parkedCar';

export type SearchIntent =
  | { type: 'empty' }
  | { type: 'url'; url: string }
  | { type: 'youtube'; query: string; url: string }
  | { type: 'navigate'; query: string }
  | { type: 'command'; command: SmartCommand }
  | { type: 'search'; query: string };

const COMMANDS: Array<[RegExp, SmartCommand]> = [
  [/^(where('s| is| did i leave) my car|where did i park|find my car|take me (back )?to my car)$/, 'parkedCar'],
  [/^(end|stop|cancel) (the )?(route|navigation|directions|trip)$/, 'endRoute'],
  [/^(start )?(mirror|mirroring)( my)?( (screen|phone|iphone))?$|^screen ?mirror(ing)?$/, 'mirror'],
  [/^(play|show|start)( my)? last( (video|photo|thing))?$/, 'playLast'],
  [/^(pause|pause (the )?(video|it)|hold on)$/, 'pause'],
  [/^(play|resume|continue|unpause|play it)$/, 'play'],
  [/^(stop|stop (the )?video|close (the )?video|stop playing)$/, 'stop'],
  [/^(home|cinema home|(show )?(the )?clock)$/, 'home'],
  [/^((show|open) )?(the )?map$/, 'map'],
  [/^(full ?screen|fill( (the )?screen)?|zoom in)$/, 'fill'],
  [/^(fit|fit (to )?(the )?screen|original size)$/, 'fit'],
  [/(memories|slide ?show)/, 'memories'],
  [/^((open|show) )?(my )?(videos|photos|library|photos and videos)$/, 'library'],
  [/^((open|show) )?settings$/, 'settings'],
  [/^(go )?(premium|pro|upgrade)$/, 'premium'],
  [/^(use|switch to|set( units to)?|change to) (kilometers|kilometres|km\/?h|metric)$/, 'unitsKmh'],
  [/^(use|switch to|set( units to)?|change to) (miles|mph|imperial)$/, 'unitsMph'],
];

const NAVIGATE_PREFIX = /^(?:take me to|navigate to|directions to|drive to|drive me to|go to|get me to|route to|head to|find (?:me )?(?:a |the )?)\s*(.+)$/;
const YOUTUBE_SUFFIX = /^(?:play |watch |search |find )?(.+?) on youtube$/;
const YOUTUBE_PREFIX = /^(?:youtube|play on youtube|search youtube for|search youtube)\s+(.+)$/;
const PLAY_QUERY = /^(?:play|watch|put on)\s+(.+)$/;
const URL_LIKE = /^(https?:\/\/\S+|[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?)$/i;

const POLITE_PREFIX = /^(hey |ok |okay )?(parkcast,? )?(please |can you |could you |i want to |i'd like to )*/;

export function youtubeSearchUrl(query: string): string {
  return `https://m.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Rewrites YouTube links to the mobile watch page, which plays inline in the car's web view. */
export function carFriendlyUrl(url: string): string {
  const shortMatch = url.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{11})/i);
  if (shortMatch) return `https://m.youtube.com/watch?v=${shortMatch[1]}`;
  const shortsMatch = url.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i);
  if (shortsMatch) return `https://m.youtube.com/watch?v=${shortsMatch[1]}`;
  return url.replace(/^https?:\/\/(www\.)?youtube\.com\//i, 'https://m.youtube.com/');
}

export function parseSmartSearch(input: string): SearchIntent {
  const raw = input.trim();
  if (!raw) return { type: 'empty' };

  if (!/\s/.test(raw) && URL_LIKE.test(raw)) {
    return { type: 'url', url: normalizeUrl(raw) };
  }

  const text = raw
    .toLowerCase()
    .replace(/[.!?]+$/, '')
    .replace(POLITE_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, command] of COMMANDS) {
    if (pattern.test(text)) return { type: 'command', command };
  }

  const ytMatch = text.match(YOUTUBE_SUFFIX) ?? text.match(YOUTUBE_PREFIX);
  if (ytMatch) {
    const query = ytMatch[1].trim();
    return { type: 'youtube', query, url: youtubeSearchUrl(query) };
  }

  const navMatch = text.match(NAVIGATE_PREFIX);
  if (navMatch && navMatch[1].trim()) {
    return { type: 'navigate', query: navMatch[1].trim() };
  }
  if (/ near (me|here)$|^nearest |^closest /.test(text)) {
    return { type: 'navigate', query: text };
  }

  const playMatch = text.match(PLAY_QUERY);
  if (playMatch) {
    const query = playMatch[1].trim();
    return { type: 'youtube', query, url: youtubeSearchUrl(query) };
  }

  return { type: 'search', query: raw };
}
