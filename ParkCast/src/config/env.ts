import Constants from 'expo-constants';

interface AdsExtra {
  enabled?: boolean;
  useTestIds?: boolean;
  iosBannerUnitId?: string;
  iosRewardedUnitId?: string;
  iosInterstitialUnitId?: string;
}

interface ParkCastExtra {
  relayUrl?: string;
  supportEmail?: string;
  weatherApiUrl?: string;
  revenueCatIosKey?: string;
  ads?: AdsExtra;
}

const extra = (Constants.expoConfig?.extra ?? {}) as ParkCastExtra;

const trimSlash = (value: string) => value.replace(/\/+$/, '');

const relayUrl = trimSlash(extra.relayUrl ?? '');

export const ENV = {
  relayUrl,
  relayWsUrl: relayUrl.replace(/^http/i, 'ws'),
  privacyUrl: relayUrl ? `${relayUrl}/privacy` : '',
  termsUrl: relayUrl ? `${relayUrl}/terms` : '',
  webScreenUrl: relayUrl ? `${relayUrl}/car` : '',
  supportEmail: extra.supportEmail ?? '',
  weatherApiUrl: extra.weatherApiUrl ?? '',
  revenueCatIosKey: extra.revenueCatIosKey ?? '',
  appVersion: Constants.expoConfig?.version ?? '',
  ads: {
    enabled: extra.ads?.enabled ?? false,
    useTestIds: extra.ads?.useTestIds ?? true,
    bannerUnitId: extra.ads?.iosBannerUnitId ?? '',
    rewardedUnitId: extra.ads?.iosRewardedUnitId ?? '',
    interstitialUnitId: extra.ads?.iosInterstitialUnitId ?? '',
  },
};
