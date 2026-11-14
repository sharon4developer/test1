import pricing from './pricing.json';

export type PlanId = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PricingPlan {
  id: PlanId;
  productId: string;
  name: string;
  price: string;
  priceValue: number;
  periodLabel: string;
  renewalLabel: string;
  trialDays?: number;
  highlight?: boolean;
  badge?: string;
}

export const PRICING_PLANS = pricing.plans as PricingPlan[];
export const PRO_ENTITLEMENT_ID = pricing.entitlementId;
export const FREE_SESSION_SECONDS = pricing.freeSessionMinutes * 60;
export const FREE_LIMIT_REACHED = `You've used today's ${pricing.freeSessionMinutes} free minutes.`;

export const BRAND = {
  appName: 'ParkCast',
  tagline: 'Your car screen, made simple',
};

export const PRO_FEATURES = [
  'Unlimited watching and mirroring',
  'Full HD video and photos on the car (free is 480p)',
  'HD mirroring at 60 fps',
  'No ads',
  'Memories slideshows of any length',
];
