export type PlanId = 'free' | 'pro_monthly' | 'pro_annual' | 'pro_lifetime';

export type VideoQuality = '480p' | '720p' | '1080p' | '4K';

export type AspectMode = 'fit' | 'fill' | 'cinema';

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
  durationLabel: string;
  thumbnailColor: string;
  streamUrl: string;
  youtubeId?: string;
  requiresPro?: boolean;
  isLive?: boolean;
}

export const BRAND = {
  appName: 'ParkCast',
  tagline: 'Watch Videos & Photos on Your Car Screen',
  version: '1.1.0',
  defaultRelayPort: 4848,
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
    feature: 'Connect to Car Screen',
    free: 'Included',
    pro: 'Included',
  },
  {
    feature: 'Phone Photos on Car Screen',
    free: 'Unlimited',
    pro: 'Unlimited',
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
    feature: 'Phone Videos from Camera Roll',
    free: '3 Videos / day',
    pro: 'Unlimited Videos',
  },
  {
    feature: 'Live Phone Screen Mirroring',
    free: 'Pro Only',
    pro: 'Included',
  },
  {
    feature: 'Widescreen Full-Fill Zoom',
    free: 'Standard Fit',
    pro: 'Full Screen & Widescreen',
  },
];

export const MEDIA_PRESETS: MediaPreset[] = [
  {
    id: 'yt-scenic-drive',
    title: 'Swiss Alps Scenic Drive',
    subtitle: 'Relaxing mountain drive video',
    category: 'youtube',
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
    durationLabel: '15 min',
    thumbnailColor: '#7C3AED',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
  {
    id: 'cinema-tears',
    title: 'Tears of Steel (Sci-Fi Short)',
    subtitle: 'Widescreen sci-fi movie',
    category: 'cinema',
    durationLabel: '12 min',
    thumbnailColor: '#059669',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
  {
    id: 'iptv-pro-motorsport',
    title: 'GT Endurance Racing Highlights',
    subtitle: 'Full HD 1080p Track Feed',
    category: 'iptv',
    durationLabel: 'HD PRO',
    thumbnailColor: '#EA580C',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    requiresPro: true,
    isLive: true,
  },
];
