import type React from 'react';

/** Platforms without Google Mobile Ads (web preview): every placement is a no-op. */

export async function initAds(): Promise<boolean> {
  return false;
}

export const AdBanner: React.FC<{ visible: boolean }> = () => null;

export async function showRewardedAd(): Promise<boolean> {
  return true;
}

export async function maybeShowInterstitial(): Promise<void> {}
