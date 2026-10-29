# Counter

One screen: a number and a button that adds 1. The count stays in memory on the phone. There is no database, server, or sign-in.

This is an Expo Go test. A real App Store build comes later and needs the Apple Developer Program.

## Install and start

From the repository root, on Linux Mint:

```bash
cd counter
npm install
npx expo start
```

`npm start` runs the same dev server. `package.json` defines `start` as `expo start`.

You need Node.js and npm installed. Use the current LTS or newer (this project was created with Node 22).

## Open the app in Expo Go on an iPhone

1. Install **Expo Go** from the App Store.
2. Put the iPhone and the Linux Mint computer on the **same Wi-Fi** network.
3. With `npx expo start` running, scan the QR code in the terminal. You can scan it with the iPhone camera, or open Expo Go and use its scanner.
4. The counter opens in Expo Go. Tap **Add 1** and the number goes up by 1.

Leave the terminal running while you test. Stop it with Ctrl+C.
