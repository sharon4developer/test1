export interface Favorite {
  title: string;
  url: string;
  color: string;
  icon: 'logo-youtube' | 'search' | 'videocam' | 'logo-twitch' | 'logo-tiktok' | 'book' | 'play-circle' | 'newspaper';
}

export const BROWSER_FAVORITES: Favorite[] = [
  { title: 'YouTube', url: 'https://m.youtube.com', color: '#FF0000', icon: 'logo-youtube' },
  { title: 'Google', url: 'https://www.google.com', color: '#1A73E8', icon: 'search' },
  { title: 'Vimeo', url: 'https://vimeo.com', color: '#1AB7EA', icon: 'videocam' },
  { title: 'Twitch', url: 'https://m.twitch.tv', color: '#9146FF', icon: 'logo-twitch' },
  { title: 'TikTok', url: 'https://www.tiktok.com', color: '#111111', icon: 'logo-tiktok' },
  { title: 'Dailymotion', url: 'https://www.dailymotion.com', color: '#0066DC', icon: 'play-circle' },
  { title: 'Wikipedia', url: 'https://en.m.wikipedia.org', color: '#555555', icon: 'book' },
  { title: 'News', url: 'https://news.google.com', color: '#0F9D58', icon: 'newspaper' },
];

export const AD_HOST_PATTERNS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.',
  'adnxs.com',
  'taboola.com',
  'outbrain.com',
  'popads.net',
  'popcash.net',
  'propellerads',
  'adsterra',
  'exoclick.com',
  'criteo.com',
  'amazon-adsystem.com',
];

export const AD_BLOCK_CSS = [
  '[id^="google_ads"]',
  '[id*="taboola"]',
  '[class*="adsbygoogle"]',
  '[class*="ad-banner"]',
  '[class*="sponsored"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'ins.adsbygoogle',
].join(',');
