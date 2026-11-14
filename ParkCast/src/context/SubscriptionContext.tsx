import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BRAND, PlanId, VideoQuality, AspectMode } from '../config/brand';

export interface SubscriptionContextValue {
  planId: PlanId;
  isPro: boolean;
  isTrialActive: boolean;
  remainingSessionSeconds: number;
  isSessionExpired: boolean;
  dailyLocalVideosUsed: number;
  maxDailyLocalVideos: number;
  paywallVisible: boolean;
  paywallReason: string | null;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  purchasePlan: (planId: Exclude<PlanId, 'free'>, withTrial?: boolean) => void;
  restorePurchases: () => boolean;
  downgradeToFreeForTesting: () => void;
  fastForwardFreeTimerForTesting: () => void;
  resetFreeSessionTimer: () => void;
  canUseQuality: (quality: VideoQuality) => boolean;
  canUseAspectMode: (mode: AspectMode) => boolean;
  recordLocalVideoCast: () => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const SubscriptionProvider: React.FC<{
  children: React.ReactNode;
  isCastingActive: boolean;
}> = ({ children, isCastingActive }) => {
  const [planId, setPlanId] = useState<PlanId>('free');
  const [isTrialActive, setIsTrialActive] = useState<boolean>(false);
  const [remainingSessionSeconds, setRemainingSessionSeconds] = useState<number>(
    BRAND.freeLimits.maxSessionSeconds
  );
  const [dailyLocalVideosUsed, setDailyLocalVideosUsed] = useState<number>(1);
  const [paywallVisible, setPaywallVisible] = useState<boolean>(false);
  const [paywallReason, setPaywallReason] = useState<string | null>(null);

  const isPro = planId !== 'free';
  const isSessionExpired = !isPro && remainingSessionSeconds <= 0;

  const openPaywall = useCallback((reason?: string) => {
    setPaywallReason(
      reason || 'Upgrade to ParkCast Pro for unlimited 1080p/4K car streaming and full screen mirroring.'
    );
    setPaywallVisible(true);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  // Countdown the 15-minute Free session timer while actively casting
  useEffect(() => {
    if (isPro || !isCastingActive) {
      return;
    }
    const interval = setInterval(() => {
      setRemainingSessionSeconds((prev) => {
        if (prev <= 1) {
          setPaywallReason(
            'Your 15-minute Free Cast session has ended. Upgrade to ParkCast Pro for unlimited non-stop playback.'
          );
          setPaywallVisible(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPro, isCastingActive]);

  const purchasePlan = useCallback(
    (targetPlan: Exclude<PlanId, 'free'>, withTrial = false) => {
      // In Expo Go development mode, activate the selected plan immediately.
      // When compiled with EAS Build + react-native-purchases, this calls Purchases.purchasePackage().
      setPlanId(targetPlan);
      setIsTrialActive(withTrial);
      setRemainingSessionSeconds(BRAND.freeLimits.maxSessionSeconds);
      setPaywallVisible(false);
      setPaywallReason(null);
    },
    []
  );

  const restorePurchases = useCallback(() => {
    setPlanId('pro_annual');
    setIsTrialActive(false);
    setPaywallVisible(false);
    return true;
  }, []);

  const downgradeToFreeForTesting = useCallback(() => {
    setPlanId('free');
    setIsTrialActive(false);
    setRemainingSessionSeconds(BRAND.freeLimits.maxSessionSeconds);
  }, []);

  const fastForwardFreeTimerForTesting = useCallback(() => {
    setPlanId('free');
    setRemainingSessionSeconds(5);
  }, []);

  const resetFreeSessionTimer = useCallback(() => {
    setRemainingSessionSeconds(BRAND.freeLimits.maxSessionSeconds);
  }, []);

  const canUseQuality = useCallback(
    (quality: VideoQuality) => {
      if (isPro) return true;
      return BRAND.freeLimits.allowedQualities.includes(quality);
    },
    [isPro]
  );

  const canUseAspectMode = useCallback(
    (mode: AspectMode) => {
      if (isPro) return true;
      return mode === 'fit';
    },
    [isPro]
  );

  const recordLocalVideoCast = useCallback(() => {
    if (isPro) return true;
    if (dailyLocalVideosUsed >= BRAND.freeLimits.maxDailyLocalVideos) {
      openPaywall(
        `You have used all ${BRAND.freeLimits.maxDailyLocalVideos} daily local video casts on the Free plan. Upgrade to Pro for unlimited camera roll casting.`
      );
      return false;
    }
    setDailyLocalVideosUsed((prev) => prev + 1);
    return true;
  }, [isPro, dailyLocalVideosUsed, openPaywall]);

  return (
    <SubscriptionContext.Provider
      value={{
        planId,
        isPro,
        isTrialActive,
        remainingSessionSeconds,
        isSessionExpired,
        dailyLocalVideosUsed,
        maxDailyLocalVideos: BRAND.freeLimits.maxDailyLocalVideos,
        paywallVisible,
        paywallReason,
        openPaywall,
        closePaywall,
        purchasePlan,
        restorePurchases,
        downgradeToFreeForTesting,
        fastForwardFreeTimerForTesting,
        resetFreeSessionTimer,
        canUseQuality,
        canUseAspectMode,
        recordLocalVideoCast,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextValue => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used inside SubscriptionProvider');
  }
  return ctx;
};
