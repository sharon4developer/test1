# ParkCast 2.0

ParkCast puts your iPhone on the car screen through CarPlay: turn-by-turn directions, your photos and videos, any website, and full-screen iPhone mirroring. Video automatically pauses while the car is moving.

The app is an Expo (SDK 58) project with a local native module, so it needs a development or EAS build. Expo Go cannot run it.

## Project layout

| Path | What it is |
| --- | --- |
| `App.tsx`, `src/` | The iPhone app (Home search, Library, Mirror, Settings, Browser, Paywall). |
| `modules/parkcast-native/ios` | Swift: the CarPlay scene, car screen, MapKit navigation, speech, and the mirroring receiver. |
| `plugins/` | Config plugins that add the CarPlay scene, entitlements and the ReplayKit broadcast extension. |
| `src/config/pricing.json` | The only place prices live. The app, paywall and server all read it. |
| `app.json` → `expo.extra` | Runtime settings: relay URL, support email, weather API, mirror port, RevenueCat key and ads. |
| `server/` | Privacy and terms pages, `/health`, and the optional web screen at `/car`. |

## Develop

```bash
npm install
npm run typecheck
npm test
npx expo prebuild --platform ios --clean   # inspect the generated Xcode project
npm run relay                              # local web services on :4848
```

## Release checklist

1. **App Store Connect:** create four auto-renewable subscriptions in one group, with product IDs `parkcast.weekly`, `parkcast.monthly`, `parkcast.quarterly` and `parkcast.yearly` (the yearly plan has a 3-day free trial).
2. **RevenueCat:** add the products, attach them to an entitlement called `pro` in the current offering, then paste the public iOS SDK key into `expo.extra.revenueCatIosKey`.
3. **Mirroring extension:** register the bundle ID `com.parkcast.carvideo.test.broadcast` in the Apple Developer portal. EAS creates its provisioning profile on the next build.
4. **CarPlay:** the production profile sets `PARKCAST_ENABLE_CARPLAY_ENTITLEMENT=true`, which needs Apple's approved `com.apple.developer.carplay-maps` entitlement on the App ID.
5. **Ads:** `expo.extra.ads` uses Google test ads. Before the App Store release, replace the AdMob app ID in the `react-native-google-mobile-ads` plugin and the unit IDs, and set `useTestIds` to `false`.
6. Build with `eas build --platform ios --profile production`, then submit with `eas submit`.
