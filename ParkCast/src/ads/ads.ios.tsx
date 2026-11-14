import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { ENV } from '../config/env';

const INTERSTITIAL_MIN_GAP_MS = 10 * 60 * 1000;

let initialized = false;
let initializing: Promise<boolean> | null = null;
let lastInterstitialAt = 0;
const readyListeners = new Set<() => void>();

const unitId = (configured: string, testId: string) => (ENV.ads.useTestIds || !configured ? testId : configured);

export function initAds(): Promise<boolean> {
  if (!ENV.ads.enabled) return Promise.resolve(false);
  if (initialized) return Promise.resolve(true);
  if (!initializing) {
    initializing = (async () => {
      try {
        await requestTrackingPermissionsAsync();
      } catch {
        // Ads still work without tracking permission; they are just not personalised.
      }
      try {
        await mobileAds().initialize();
        initialized = true;
        readyListeners.forEach((listener) => listener());
      } catch {
        initialized = false;
      }
      return initialized;
    })();
  }
  return initializing;
}

export const AdBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  const [ready, setReady] = useState(initialized);
  useEffect(() => {
    const listener = () => setReady(true);
    readyListeners.add(listener);
    return () => {
      readyListeners.delete(listener);
    };
  }, []);
  if (!visible || !ready || !ENV.ads.enabled) return null;
  return (
    <View style={{ alignItems: 'center', marginBottom: 12 }}>
      <BannerAd unitId={unitId(ENV.ads.bannerUnitId, TestIds.ADAPTIVE_BANNER)} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
};

/** Resolves true when the user may continue (reward earned, or no ad could be shown). */
export function showRewardedAd(): Promise<boolean> {
  if (!ENV.ads.enabled || !initialized) return Promise.resolve(true);
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(unitId(ENV.ads.rewardedUnitId, TestIds.REWARDED));
    let earned = false;
    let loaded = false;
    let done = false;
    const unsubscribers: Array<() => void> = [];
    const finish = (allowed: boolean) => {
      if (done) return;
      done = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      resolve(allowed);
    };
    unsubscribers.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        loaded = true;
        ad.show().catch(() => finish(true));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(AdEventType.ERROR, () => finish(true))
    );
    ad.load();
    setTimeout(() => {
      if (!loaded) finish(true);
    }, 8000);
  });
}

export async function maybeShowInterstitial(): Promise<void> {
  if (!ENV.ads.enabled || !initialized) return;
  if (Date.now() - lastInterstitialAt < INTERSTITIAL_MIN_GAP_MS) return;
  lastInterstitialAt = Date.now();
  const ad = InterstitialAd.createForAdRequest(unitId(ENV.ads.interstitialUnitId, TestIds.INTERSTITIAL));
  const unsubscribe = ad.addAdEventListener(AdEventType.LOADED, () => {
    unsubscribe();
    ad.show().catch(() => {});
  });
  ad.load();
}
