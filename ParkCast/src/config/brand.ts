export type PlanId = 'free' | 'pro_monthly' | 'pro_annual' | 'pro_lifetime';

export type VideoQuality = '480p' | '720p' | '1080p' | '4K';

export type AspectMode = 'fit' | 'fill' | 'cinema';

export type CarScreenTab = 'library' | 'browser' | 'mirror' | 'map';

export type SpeedUnit = 'mph' | 'kmh';

export type NavProvider = 'apple_maps' | 'waze' | 'google_maps';

export interface PricingPlan {
  id: Exclude<PlanId, 'free'>;
  name: string;
  badge?: string;
  price: string;
  period: string;
  subtext: string;
  trialLabel?: string;
  revenueCatProductId: string;
  savings?: string;
}

export interface MediaPreset {
  id: string;
  title: string;
  subtitle: string;
  category: 'youtube' | 'cinema' | 'iptv' | 'local';
  groupTitle?: string;
  durationLabel: string;
  thumbnailColor: string;
  streamUrl: string;
  youtubeId?: string;
  requiresPro?: boolean;
  isLive?: boolean;
}

export interface IptvChannel {
  id: string;
  name: string;
  group: string;
  logo?: string;
  streamUrl: string;
  isFavorite?: boolean;
}

export interface IptvPlaylistSource {
  id: string;
  name: string;
  type: 'm3u_url' | 'xtream' | 'jellyfin';
  url: string;
  username?: string;
  lastRefreshedAt: string;
  channelCount: number;
}

export const BRAND = {
  appName: 'ParkCast',
  tagline: 'Watch Videos, Live TV & Mirror on Your Car Screen',
  version: '1.2.0',
  defaultRelayPort: 4848,
  cloudRelayUrl: 'https://parkcast-x9nd.onrender.com',
  privacyPolicyUrl: 'https://parkcast-x9nd.onrender.com/privacy',
  termsOfUseUrl: 'https://parkcast-x9nd.onrender.com/terms',
  supportUrl: 'https://parkcast-x9nd.onrender.com/car',
  freeLimits: {
    maxSessionSeconds: 15 * 60, // 15 minutes per free cast session
    maxDailyLocalVideos: 3,
    allowedQualities: ['480p'] as VideoQuality[],
  },
  revenueCat: {
    iosApiKey: 'appl_REPLACE_WITH_REVENUECAT_IOS_KEY',
    androidApiKey: 'goog_REPLACE_WITH_REVENUECAT_ANDROID_KEY',
    entitlementId: 'pro',
    useMockStoreInExpoGo: true,
  },
  colors: {
    bgPrimary: '#F4F6FB',
    bgSecondary: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgCardElevated: '#EEF2FF',
    borderSubtle: '#E2E8F0',
    accentBlue: '#2563EB',
    accentCyan: '#0284C7',
    accentGold: '#D97706',
    accentPurple: '#7C3AED',
    statusConnected: '#10B981',
    statusWarning: '#F59E0B',
    statusDanger: '#EF4444',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
  },
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'pro_annual',
    name: 'Yearly Plan',
    badge: 'BEST VALUE · SAVE 58%',
    price: '$24.99',
    period: '/ year',
    subtext: 'Just $2.08 per month',
    trialLabel: 'Includes 3-Day Free Trial',
    revenueCatProductId: 'parkcast_pro_yearly_2499',
    savings: 'Save 58%',
  },
  {
    id: 'pro_monthly',
    name: 'Monthly Plan',
    price: '$4.99',
    period: '/ month',
    subtext: 'Pay month-to-month, cancel anytime',
    revenueCatProductId: 'parkcast_pro_monthly_499',
  },
  {
    id: 'pro_lifetime',
    name: 'Lifetime Access',
    badge: 'PAY ONCE FOREVER',
    price: '$49.99',
    period: 'one time',
    subtext: 'No monthly bills ever again',
    revenueCatProductId: 'parkcast_pro_lifetime_4999',
  },
];

export const FEATURE_COMPARISON = [
  {
    feature: 'Works in Every CarPlay Car (iOS 27.2+ Ready)',
    free: 'Included',
    pro: 'Included',
  },
  {
    feature: 'Phone Photos & M3U / Xtream IPTV Player',
    free: 'Included',
    pro: 'Unlimited + Auto-Refresh',
  },
  {
    feature: 'Car Web Browser + iPhone Trackpad',
    free: 'Included',
    pro: 'Full Screen + Split-View',
  },
  {
    feature: 'Turn-by-Turn Nav (Apple Maps, Waze, Google)',
    free: 'MPH & KM/H',
    pro: 'Split-Screen Beside Video',
  },
  {
    feature: 'Video Quality',
    free: 'Standard (480p)',
    pro: 'Full HD (1080p & 4K)',
  },
  {
    feature: 'Play Time per Session',
    free: '15 Minutes',
    pro: 'Unlimited Time',
  },
  {
    feature: 'Live Whole-Phone Screen Mirroring (60fps)',
    free: 'Pro Only',
    pro: 'Included',
  },
];

export const DEFAULT_IPTV_CHANNELS: IptvChannel[] = [
  {
    id: 'iptv-redbull-tv',
    name: 'Red Bull Motorsport Live',
    group: 'Sports & Racing',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    isFavorite: true,
  },
  {
    id: 'iptv-scenic-alps',
    name: 'Alps 4K Nature Lounge',
    group: 'Relax & Ambience',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    isFavorite: true,
  },
  {
    id: 'iptv-sintel-cinema',
    name: 'Open Cinema HD · Sintel',
    group: 'Movies & Cinema',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
  {
    id: 'iptv-scifi-tears',
    name: 'Sci-Fi Channel · Tears of Steel',
    group: 'Movies & Cinema',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
  {
    id: 'iptv-kids-bunny',
    name: 'Family Cartoons · Big Buck Bunny',
    group: 'Kids & Family',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
];

export const MEDIA_PRESETS: MediaPreset[] = [
  {
    id: 'yt-scenic-drive',
    title: 'Swiss Alps Scenic Drive',
    subtitle: 'Relaxing mountain drive video',
    category: 'youtube',
    groupTitle: 'Relax & Ambience',
    durationLabel: '12 min',
    thumbnailColor: '#2563EB',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    youtubeId: 'ysz5S6PUM-U',
  },
  {
    id: 'cinema-sintel',
    title: 'Sintel (Animated Short Movie)',
    subtitle: 'Family adventure movie',
    category: 'cinema',
    groupTitle: 'Movies & Cinema',
    durationLabel: '15 min',
    thumbnailColor: '#7C3AED',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
  {
    id: 'cinema-tears',
    title: 'Tears of Steel (Sci-Fi Short)',
    subtitle: 'Widescreen sci-fi movie',
    category: 'cinema',
    groupTitle: 'Movies & Cinema',
    durationLabel: '12 min',
    thumbnailColor: '#059669',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
  {
    id: 'iptv-pro-motorsport',
    title: 'GT Endurance Racing Highlights',
    subtitle: 'Full HD 1080p Track Feed',
    category: 'iptv',
    groupTitle: 'Sports & Racing',
    durationLabel: 'HD PRO',
    thumbnailColor: '#EA580C',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    requiresPro: true,
    isLive: true,
  },
];
