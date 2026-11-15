import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { ENV } from '../config/env';
import { FREE_SESSION_SECONDS, PRICING_PLANS, PRO_ENTITLEMENT_ID, type PlanId, type PricingPlan } from '../config/brand';
import { loadJson, saveJson } from '../lib/storage';

export interface PlanOffer extends PricingPlan {
  /** Localised App Store price when the store answered, otherwise the configured list price. */
  displayPrice: string;
  fromStore: boolean;
}

interface SubscriptionContextValue {
  isPro: boolean;
  storeReady: boolean;
  offers: PlanOffer[];
  freeSecondsLeft: number;
  paywallVisible: boolean;
  paywallReason: string;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  purchase: (planId: PlanId) => Promise<boolean>;
  restore: () => Promise<boolean>;
  manageSubscription: () => void;
  setWatching: (watching: boolean) => void;
}

const USAGE_KEY = 'parkcast.freeUsage.v2';
const today = () => new Date().toISOString().slice(0, 10);

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const hasPro = (info: CustomerInfo | null | undefined) => Boolean(info?.entitlements.active[PRO_ENTITLEMENT_ID]);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPro, setIsPro] = useState(false);
  const [storeReady, setStoreReady] = useState(false);
  const [packages, setPackages] = useState<Record<string, PurchasesPackage>>({});
  const [usedSeconds, setUsedSeconds] = useState(0);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');
  const [watching, setWatching] = useState(false);
  const usageDate = useRef(today());

  useEffect(() => {
    loadJson(USAGE_KEY, { date: today(), usedSeconds: 0 }).then((usage) => {
      if (usage.date === today()) setUsedSeconds(usage.usedSeconds);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !ENV.revenueCatIosKey) return;
    let cancelled = false;
    (async () => {
      try {
        Purchases.configure({ apiKey: ENV.revenueCatIosKey });
        Purchases.addCustomerInfoUpdateListener((info) => setIsPro(hasPro(info)));
        const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
        if (cancelled) return;
        setIsPro(hasPro(info));
        const byProduct: Record<string, PurchasesPackage> = {};
        for (const pkg of offerings.current?.availablePackages ?? []) {
          byProduct[pkg.product.identifier] = pkg;
        }
        setPackages(byProduct);
        setStoreReady(true);
      } catch {
        setStoreReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isPro || !watching) return;
    const interval = setInterval(() => {
      setUsedSeconds((previous) => {
        if (usageDate.current !== today()) {
          usageDate.current = today();
          previous = 0;
        }
        const next = previous + 1;
        if (next % 10 === 0 || next >= FREE_SESSION_SECONDS) {
          saveJson(USAGE_KEY, { date: usageDate.current, usedSeconds: next });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPro, watching]);

  const freeSecondsLeft = isPro ? Infinity : Math.max(0, FREE_SESSION_SECONDS - usedSeconds);

  const openPaywall = useCallback((reason?: string) => {
    setPaywallReason(reason ?? '');
    setPaywallVisible(true);
  }, []);

  const closePaywall = useCallback(() => setPaywallVisible(false), []);

  const offers = useMemo<PlanOffer[]>(
    () =>
      PRICING_PLANS.map((plan) => {
        const pkg = packages[plan.productId];
        return { ...plan, displayPrice: pkg?.product.priceString ?? plan.price, fromStore: Boolean(pkg) };
      }),
    [packages]
  );

  const purchase = useCallback(
    async (planId: PlanId) => {
      const plan = PRICING_PLANS.find((entry) => entry.id === planId);
      const pkg = plan ? packages[plan.productId] : undefined;
      if (!pkg) {
        throw new Error(
          storeReady
            ? 'This plan is not available in the App Store yet. Please try another plan.'
            : 'The App Store is not reachable right now. Check your connection and try again.'
        );
      }
      try {
        const result = await Purchases.purchasePackage(pkg);
        const active = hasPro(result.customerInfo);
        setIsPro(active);
        if (active) setPaywallVisible(false);
        return active;
      } catch (error: any) {
        if (error?.userCancelled) return false;
        throw error;
      }
    },
    [packages, storeReady]
  );

  const restore = useCallback(async () => {
    if (!storeReady) throw new Error('The App Store is not reachable right now. Check your connection and try again.');
    const info = await Purchases.restorePurchases();
    const active = hasPro(info);
    setIsPro(active);
    if (active) setPaywallVisible(false);
    return active;
  }, [storeReady]);

  const manageSubscription = useCallback(() => {
    Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      isPro,
      storeReady,
      offers,
      freeSecondsLeft,
      paywallVisible,
      paywallReason,
      openPaywall,
      closePaywall,
      purchase,
      restore,
      manageSubscription,
      setWatching,
    }),
    [isPro, storeReady, offers, freeSecondsLeft, paywallVisible, paywallReason, openPaywall, closePaywall, purchase, restore, manageSubscription]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used inside SubscriptionProvider');
  return context;
}
