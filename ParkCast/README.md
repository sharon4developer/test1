# ParkCast: Car Video & Screen Mirror (`Expo Go` + Linux)

**ParkCast** is a React Native (Expo) iPhone controller and Car Display Receiver application designed to be developed and tested directly from a **Linux laptop** using **Expo Go**—with a built-in **Free vs. Pro Subscription Engine** (RevenueCat + Apple StoreKit 2 ready).

---

## Quick Start on Your Linux Laptop

```bash
cd /var/www/html/ParkCast

# 1. Start the lightweight 4-digit PIN pairing relay (optional, for multi-device sync)
npm run relay

# 2. In another terminal, launch Expo for your iPhone (Expo Go) and Web Receiver
npx expo start --tunnel
# (or `npx expo start` when your Linux laptop and iPhone are on the same Wi-Fi)
```

- **On your iPhone**: Open the **Camera** app, scan the QR code printed in your Linux terminal, and the app opens inside **Expo Go**.
- **On a Car Browser / Tablet / Desktop Preview**: Run `npm run web` (or open the Expo web URL) to view the **Split Studio (iPhone + Car Screen)** or switch to **Car Display Receiver** mode.

---

## Free vs. Paid (Pro) Subscription Model

No custom payment database or backend is required. Payments are structured for **Apple In-App Purchases (StoreKit 2)** managed through **RevenueCat** (`react-native-purchases`), which is free up to $2,500/month in tracked revenue.

| Feature | Free Starter Plan ($0) | ParkCast Pro ($4.99/mo · $24.99/yr · $49.99 Lifetime) |
|---|---|---|
| **Car Screen Pairing (4-Digit PIN & AirPlay)** | Included | Included + Multi-Car Profiles |
| **YouTube & Web Video Streaming** | Up to `480p SD` · `15 min` per session | `1080p Full HD` & `4K UHD` · Unlimited duration |
| **Camera Roll Videos & Photos** | Unlimited Photos + `3 Videos/day` | Unlimited Videos & Photo Albums |
| **Real-Time iPhone Screen Mirroring** | Locked | Unlocked (`60fps` Broadcast Mode) |
| **IPTV & Custom `.m3u8` / `.mp4` Links** | 1 Saved Stream | Unlimited Custom M3U8 Channels |
| **Car Cinema Scaling (`Fit` / `Fill` / `21:9 Zoom`)** | Standard Fit Only | Full-Bleed Fill, Cinema Zoom & Left/Right Driver Dock |

---

## Building for the iOS App Store / TestFlight from Linux (No Mac Required)

When you are ready to build a standalone `.ipa` for your iPhone or publish to TestFlight / App Store Connect from Linux:

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile preview
```

Expo Application Services (EAS) compiles and signs the native iOS binary in the cloud directly from your Linux terminal.
