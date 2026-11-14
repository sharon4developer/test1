import type { IconName } from '../ui/components';

/** Ids match NavigationEngine.nearbyCategories on the native side. */
export const NEARBY_CATEGORIES: Array<{ id: string; label: string; icon: IconName; color: string }> = [
  { id: 'gas', label: 'Gas', icon: 'speedometer', color: '#D93025' },
  { id: 'ev', label: 'EV charging', icon: 'flash', color: '#12A150' },
  { id: 'parking', label: 'Parking', icon: 'car', color: '#1A73E8' },
  { id: 'coffee', label: 'Coffee', icon: 'cafe', color: '#8D5524' },
  { id: 'food', label: 'Food', icon: 'restaurant', color: '#E8710A' },
  { id: 'restroom', label: 'Restrooms', icon: 'man', color: '#5B6475' },
  { id: 'grocery', label: 'Groceries', icon: 'cart', color: '#0F9D58' },
  { id: 'pharmacy', label: 'Pharmacy', icon: 'medkit', color: '#C2185B' },
];

export const METER_OPTIONS_MINUTES = [15, 30, 60, 120];
