# GPS Speed Tracker

A simple, mobile-first web speedometer. Open the site, allow GPS, start tracking, and see your real-time speed, max/average speed, distance, duration and GPS accuracy.

Everything runs in the browser. **There is no backend, and your location data never leaves your device.**

## Features

- Live current speed (km/h, mph, m/s) on a large digital gauge
- Max speed, average speed (distance ÷ moving time), distance, session time, moving time
- GPS accuracy with an Excellent / Good / Fair / Poor rating
- Status indicator: GPS READY · ACQUIRING · TRACKING · GPS SIGNAL WEAK · GPS ERROR
- Noise handling: accuracy gate, stationary-drift suppression, EMA smoothing, outlier rejection
- Keeps the screen awake while tracking (Screen Wake Lock), where the browser supports it
- Landscape layout for phones mounted in a vehicle

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run dev:https` | Start the dev server over self-signed HTTPS on your LAN (for phones) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run preview:https` | Serve the production build over HTTPS on your LAN |
| `npm test` | Run unit tests (Vitest) |
| `npm run typecheck` | TypeScript check only |

### Simulated GPS (development only)

Open `http://localhost:5173/?simulate` to swap real GPS for a simulated drive. It accelerates, cruises, brakes and idles, and adds noise, occasional bad fixes and GPS jumps. Use it to test the UI and the filters without moving. A **SIMULATED GPS** badge appears while it's on. This mode is never active in production builds.

## Browser GPS requirements

- The app uses `navigator.geolocation.watchPosition()` with `enableHighAccuracy: true`, `maximumAge: 1000`, `timeout: 10000` (configurable in `src/constants/tracking.ts`).
- **HTTPS is required.** Browsers only expose geolocation in a secure context: `https://` or `http://localhost`. Opening the dev server via a LAN IP over plain `http://` will show an "HTTPS required" error.
- The user must grant location permission. If it's denied, re-enable it in the browser's site settings.
- Many browsers return `coords.speed = null`. The app then calculates speed from consecutive coordinates using the Haversine formula.
- Desktop computers usually locate you via Wi-Fi or IP, which is coarse and doesn't move. Use a phone outdoors for real speed readings.

## Testing on a phone

1. Connect the phone and computer to the same Wi-Fi network.
2. Run `npm run dev:https`. Vite prints a `Network: https://192.168.x.x:5173` URL.
3. Open that URL on the phone and accept the self-signed certificate warning.
4. Tap **ENABLE GPS** or **START TRACKING** and allow location access.
5. Go outside with a clear view of the sky. Accuracy should improve to "Good" or "Excellent" within a few seconds.

Another option is a tunnelling service such as `npx localtunnel --port 5173` or `cloudflared`, which gives you a public HTTPS URL. Or deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages); they all serve over HTTPS.

> Keep the page in the foreground. Mobile browsers pause geolocation for background tabs and when the screen locks. The app asks the screen to stay on while tracking.

## Architecture

```
src/
├── components/        UI only (SpeedDisplay, StatsCard, TrackingControls, GPSStatus, UnitSelector, PermissionPrompt)
├── hooks/
│   ├── useGPSTracking.ts   Browser adapter: geolocation → session engine
│   └── useWakeLock.ts      Keeps screen on while tracking
├── utils/             Pure, platform-agnostic logic (no browser APIs)
│   ├── geo.ts         Haversine distance
│   ├── speed.ts       Unit conversion, smoothing, outlier detection, accuracy rating
│   ├── distance.ts    Movement threshold, distance unit conversion
│   ├── session.ts     Session statistics engine + stopwatch
│   └── format.ts      Display formatting
├── types/gps.ts       GPSPoint, TrackingSession, TrackingStatus, SpeedUnit, …
├── constants/tracking.ts   All tunable thresholds
└── dev/simulatedGeolocation.ts   Dev-only GPS simulator
```

### How a GPS fix is processed (`utils/session.ts`)

1. **Accuracy gate.** Fixes worse than `MAX_ACCEPTABLE_ACCURACY` (50 m) update the accuracy display but are ignored for statistics.
2. **Raw speed.** Use `coords.speed` when available. Otherwise use the displacement from the last anchor point divided by elapsed time (Haversine).
3. **Drift suppression.** Movement only counts once the displacement exceeds `max(3 m, 0.5 × accuracy)`. While stationary, the anchor is refreshed every 10 s so noise can't add up.
4. **Outlier protection.** Readings above ~350 km/h, or implying more than 12 m/s² of acceleration, are rejected. After 3 rejections in a row the engine resyncs, without crediting distance or max speed.
5. **Statistics.** Distance and moving time accumulate only while moving (≥ 1 km/h). Average = distance ÷ moving time. Max speed uses accepted raw readings.
6. **Smoothing.** The displayed speed is an EMA (`prev × 0.7 + current × 0.3`) and snaps to 0 below the stop threshold.

### Reusing in React Native / Expo

Everything in `utils/`, `types/` and `constants/` is free of browser APIs and can move to a shared package unchanged. A mobile app only needs its own adapter hook that turns `expo-location` updates into `GPSPoint`s and passes them to `processPoint()`. `useGPSTracking` also accepts a `geolocation` provider option, so other location sources can be plugged in.

## Privacy

There are no network calls for location, no analytics and no backend. Only your chosen speed unit is stored, in `localStorage`.

## Accuracy disclaimer

GPS-derived speed is an estimate. Its quality depends on signal conditions, device hardware and surroundings (buildings, tunnels, being indoors). The app always shows the current GPS accuracy so you can judge how reliable a reading is. Don't use it as a substitute for a calibrated vehicle speedometer.
