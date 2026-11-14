import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type CarMode = 'home' | 'map' | 'video' | 'photo' | 'slideshow' | 'web' | 'mirror';

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

export interface ParkedCar {
  latitude: number;
  longitude: number;
  timestamp: number;
  source: 'car' | 'manual';
  address: string;
}

export interface RouteStep {
  instructions: string;
  distance: number;
}

export interface RouteOption {
  index: number;
  name: string;
  distance: number;
  expectedTravelTime: number;
  advisories: string[];
  steps: RouteStep[];
}

export interface RouteProgress {
  active: boolean;
  arrived?: boolean;
  instruction?: string;
  distanceToManeuver?: number;
  remainingDistance?: number;
  remainingTime?: number;
  destination?: string;
}

export type CarCommand =
  | { type: 'mode'; mode: CarMode }
  | { type: 'playing'; value: boolean }
  | { type: 'fill'; value: boolean }
  | { type: 'playLibraryItem'; id: string }
  | { type: 'navigatePlace'; name: string }
  | { type: 'ended' }
  | { type: 'sleepEnded' };

export interface NativeStatus {
  carConnected: boolean;
  mirroring: boolean;
  mirrorAvailable: boolean;
  moving: boolean;
  usesMetric: boolean;
}

interface Subscription {
  remove: () => void;
}

interface ParkCastNativeModule {
  getStatus(): NativeStatus;
  sendCarState(state: Record<string, unknown>): void;
  control(action: string, value: number): void;
  searchPlaces(query: string): Promise<PlaceResult[]>;
  searchNearby(category: string): Promise<PlaceResult[]>;
  getParkedCar(): ParkedCar | null;
  saveParkedCarHere(): Promise<boolean>;
  clearParkedCar(): void;
  scheduleReminder(seconds: number, title: string, body: string): Promise<boolean>;
  cancelReminder(): void;
  getRoutes(latitude: number, longitude: number, name: string): Promise<RouteOption[]>;
  startNavigation(index: number): Promise<boolean>;
  stopNavigation(): Promise<void>;
  startListening(): Promise<void>;
  stopListening(): void;
  showBroadcastPicker(): Promise<void>;
  clearWebData(): Promise<void>;
  addListener(event: string, listener: (payload: any) => void): Subscription;
}

const native =
  Platform.OS === 'ios' ? requireOptionalNativeModule<ParkCastNativeModule>('ParkCastNative') : null;

/** True when running inside the real ParkCast iOS build (not Expo Go or the web preview). */
export const isNativeAvailable = native != null;

const noopSubscription: Subscription = { remove: () => {} };

export const ParkCastNative = {
  getStatus(): NativeStatus | null {
    return native ? native.getStatus() : null;
  },
  sendCarState(state: Record<string, unknown>) {
    native?.sendCarState(state);
  },
  control(action: 'seekBy' | 'seekTo' | 'nextSlide', value = 0) {
    native?.control(action, value);
  },
  async searchPlaces(query: string): Promise<PlaceResult[]> {
    return native ? native.searchPlaces(query) : [];
  },
  async searchNearby(category: string): Promise<PlaceResult[]> {
    if (!native) throw new Error('Nearby search needs the ParkCast iPhone app.');
    return native.searchNearby(category);
  },
  getParkedCar(): ParkedCar | null {
    return native ? native.getParkedCar() : null;
  },
  async saveParkedCarHere(): Promise<boolean> {
    return native ? native.saveParkedCarHere() : false;
  },
  clearParkedCar() {
    native?.clearParkedCar();
  },
  async scheduleReminder(seconds: number, title: string, body: string): Promise<boolean> {
    return native ? native.scheduleReminder(seconds, title, body) : false;
  },
  cancelReminder() {
    native?.cancelReminder();
  },
  async getRoutes(place: PlaceResult): Promise<RouteOption[]> {
    if (!native) throw new Error('Directions need the ParkCast iPhone app.');
    return native.getRoutes(place.latitude, place.longitude, place.name);
  },
  async startNavigation(index: number): Promise<boolean> {
    return native ? native.startNavigation(index) : false;
  },
  async stopNavigation(): Promise<void> {
    if (native) await native.stopNavigation();
  },
  async startListening(): Promise<void> {
    if (!native) throw new Error('Voice needs the ParkCast iPhone app.');
    await native.startListening();
  },
  stopListening() {
    native?.stopListening();
  },
  async showBroadcastPicker(): Promise<void> {
    if (!native) throw new Error('Mirroring needs the ParkCast iPhone app.');
    await native.showBroadcastPicker();
  },
  async clearWebData(): Promise<void> {
    if (native) await native.clearWebData();
  },
  on<T = any>(event: string, listener: (payload: T) => void): Subscription {
    return native ? native.addListener(event, listener) : noopSubscription;
  },
};
