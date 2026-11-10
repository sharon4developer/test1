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
  tagline: 'Car Video & Screen Mirror',
  version: '1.0.0',
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
    bgPrimary: '#080C14',
    bgSecondary: '#101726',
    bgCard: '#151E31',
    bgCardElevated: '#1C2840',
    borderSubtle: '#263554',
    accentBlue: '#3B82F6',
    accentCyan: '#06B6D4',
    accentGold: '#F59E0B',
    accentPurple: '#8B5CF6',
    statusConnected: '#10B981',
    statusWarning: '#F59E0B',
    statusDanger: '#EF4444',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
  },
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'pro_annual',
    name: 'ParkCast Pro Annual',
    badge: 'MOST POPULAR · SAVE 58%',
    price: '$24.99',
    period: '/ year',
    subtext: 'Just $2.08/month · Billed annually',
    trialLabel: '3-Day Free Trial Included',
    revenueCatProductId: 'parkcast_pro_yearly_2499',
    savings: 'Save 58%',
  },
  {
    id: 'pro_monthly',
    name: 'ParkCast Pro Monthly',
    price: '$4.99',
    period: '/ month',
    subtext: 'Flexible monthly access · Cancel anytime',
    revenueCatProductId: 'parkcast_pro_monthly_499',
  },
  {
    id: 'pro_lifetime',
    name: 'ParkCast Pro Lifetime',
    badge: 'ONE-TIME PAYMENT',
    price: '$49.99',
    period: 'once',
    subtext: 'Pay once, own Pro forever on all your cars',
    revenueCatProductId: 'parkcast_pro_lifetime_4999',
  },
];

export const FEATURE_COMPARISON = [
  {
    feature: 'Car Screen Pairing & AirPlay Cast',
    free: 'Included',
    pro: 'Included + Multi-Car Profiles',
  },
  {
    feature: 'YouTube & Web Video Streaming',
    free: '480p SD · 15 min/session',
    pro: '1080p HD & 4K · Unlimited',
  },
  {
    feature: 'Local Camera Roll Videos & Photos',
    free: 'Photos + 3 Videos/day',
    pro: 'Unlimited Videos & Albums',
  },
  {
    feature: 'Full iPhone Screen Mirroring',
    free: 'Locked',
    pro: 'Real-Time Mirroring Unlocked',
  },
  {
    feature: 'IPTV / M3U8 Live Channels',
    free: '1 Sample Channel',
    pro: 'Unlimited Custom M3U Lists',
  },
  {
    feature: 'Car Cinema Aspect Fit / Fill / Zoom',
    free: 'Standard Fit Only',
    pro: 'Fit, Full-Bleed Fill & Cinema Zoom',
  },
  {
    feature: 'Phone Lock-Screen Audio/Video Hold',
    free: 'Locked',
    pro: 'Included',
  },
];

export const MEDIA_PRESETS: MediaPreset[] = [
  {
    id: 'yt-scenic-drive',
    title: 'Swiss Alps 4K Scenic Drive & Lounge',
    subtitle: 'YouTube Cast · Automotive HDR Showcase',
    category: 'youtube',
    durationLabel: '12:45',
    thumbnailColor: '#1E3A8A',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    youtubeId: 'ysz5S6PUM-U',
  },
  {
    id: 'cinema-sintel',
    title: 'Sintel: Open Movie Theater Cut',
    subtitle: 'Direct MP4 Cinema Stream · Surround Audio',
    category: 'cinema',
    durationLabel: '14:48',
    thumbnailColor: '#312E81',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
  {
    id: 'cinema-tears',
    title: 'Tears of Steel (Sci-Fi Short Film)',
    subtitle: 'Direct HD Stream · Wide Aspect 21:9',
    category: 'cinema',
    durationLabel: '12:14',
    thumbnailColor: '#064E3B',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
  {
    id: 'iptv-news-live',
    title: 'AutoPulse Live Sports & News Desk',
    subtitle: 'HLS Live Stream · M3U8 Channel #01',
    category: 'iptv',
    durationLabel: 'LIVE',
    thumbnailColor: '#7C2D12',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    isLive: true,
  },
  {
    id: 'iptv-pro-motorsport',
    title: 'GT World Endurance Live Telemetry Channel',
    subtitle: 'Pro M3U8 1080p60 Feed · Channel #02',
    category: 'iptv',
    durationLabel: 'LIVE 1080p',
    thumbnailColor: '#581C87',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    requiresPro: true,
    isLive: true,
  },
];
