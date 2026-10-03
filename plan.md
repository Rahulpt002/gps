# Build a GPS Travel Speed Tracker Web App

Build a simple, modern web application whose primary purpose is to track the user's travelling speed using the device's GPS/location services.

The first version must be a **web application only**. Design the architecture so the GPS/speed calculation logic can later be reused or adapted for a React Native/Expo mobile application.

## 1. Core Goal

The application should continuously obtain the user's GPS location and calculate their current travelling speed.

The main screen should behave like a simple digital speedometer.

The user should be able to:

- Start GPS tracking
- Stop GPS tracking
- See current speed
- See maximum speed
- See average speed
- See travelled distance
- See GPS accuracy
- See tracking duration
- Reset the current session

Do not add unnecessary features in this first version.

---

# 2. Technology

Use:

- React
- TypeScript
- Vite
- Modern CSS or Tailwind CSS
- Browser Geolocation API
- `navigator.geolocation.watchPosition()`

Do NOT use a backend for the first version.

All tracking should happen locally in the browser.

Use `localStorage` only if necessary for preserving a session.

---

# 3. Main UI

Create a clean mobile-first interface.

The main screen should contain:

### Speed Display

Make the current speed the dominant element.

Example:

```text
        62.4
       km/h

      CURRENT SPEED
```

Use a large digital-style number.

Allow the user to switch between:

- km/h
- mph
- m/s

Default to:

```text
km/h
```

---

# 4. Statistics

Below the speed display show cards for:

```text
MAX SPEED
82.7 km/h

AVERAGE SPEED
54.3 km/h

DISTANCE
12.84 km

TIME
00:27:42

GPS ACCURACY
±8 m
```

The statistics should update while tracking.

---

# 5. Start / Stop Tracking

Provide a large button:

```text
START TRACKING
```

After tracking begins:

```text
STOP TRACKING
```

When tracking starts:

1. Request location permission.
2. Start `navigator.geolocation.watchPosition()`.
3. Store the initial GPS position.
4. Start the timer.
5. Begin calculating speed and distance.

When tracking stops:

1. Stop the GPS watcher.
2. Stop the timer.
3. Preserve the session statistics on screen.

---

# 6. GPS Speed Calculation

Use the GPS position data:

```javascript
position.coords.speed
```

when available.

However, browsers/devices may return:

```text
null
```

for GPS speed.

Therefore implement a fallback calculation.

When GPS speed is unavailable:

```text
distance between previous GPS coordinate
----------------------------------------
time between GPS readings
```

Calculate speed using the Haversine formula.

Convert:

```text
meters/second → km/h
```

using:

```text
km/h = m/s × 3.6
```

For mph:

```text
mph = m/s × 2.236936
```

---

# 7. GPS Accuracy Handling

Use:

```javascript
position.coords.accuracy
```

Display it in meters.

Example:

```text
GPS Accuracy
±7 m
```

Add a small quality indicator:

```text
Excellent
Good
Fair
Poor
```

Do not pretend GPS is accurate when it isn't.

For example:

```text
accuracy < 10m → Excellent
10–25m → Good
25–50m → Fair
>50m → Poor
```

Make these thresholds easy to modify in configuration/constants.

---

# 8. Speed Filtering

GPS readings can be noisy.

Implement basic smoothing so the displayed speed doesn't jump wildly.

Use a rolling average or exponential moving average.

For example:

```text
smoothedSpeed =
    previousSpeed * 0.7 +
    currentSpeed * 0.3
```

Make the smoothing factor configurable.

Do not over-engineer this.

The goal is a stable speedometer.

---

# 9. Distance Calculation

Calculate travelled distance using consecutive GPS coordinates.

Use the Haversine formula.

Example:

```text
Location A
11.2588, 75.7804

Location B
11.2595, 75.7811
```

Calculate the distance between them and add it to the session distance.

Ignore extremely inaccurate GPS readings when calculating distance.

For example, make a configurable maximum acceptable accuracy:

```text
MAX_ACCEPTABLE_ACCURACY = 50 meters
```

---

# 10. Average Speed

Calculate average travelling speed based on:

```text
total distance / moving time
```

Do not simply average every GPS speed reading.

Also track moving time separately from total session time.

Treat the vehicle/person as stopped when speed is below a configurable threshold.

Default:

```text
STOP_SPEED_THRESHOLD = 1 km/h
```

---

# 11. Maximum Speed

Keep track of the highest reliable speed recorded during the session.

Avoid allowing one obviously bad GPS reading to create an unrealistic max speed.

Add basic outlier protection.

For example, ignore sudden impossible jumps where:

```text
speed difference
```

is far beyond what a vehicle could realistically achieve between two GPS samples.

Keep this logic configurable rather than hardcoding assumptions everywhere.

---

# 12. Tracking Status

Show a clear status:

```text
● GPS READY
```

or:

```text
● TRACKING
```

or:

```text
● GPS SIGNAL WEAK
```

or:

```text
● GPS ERROR
```

Use appropriate visual indicators.

---

# 13. Permission Handling

If location permission hasn't been granted, show:

```text
Location permission is required to measure your speed.
```

Provide a button:

```text
ENABLE GPS
```

Handle:

- Permission denied
- Permission unavailable
- Position timeout
- GPS unavailable
- Browser not supporting geolocation

with clear user-friendly messages.

---

# 14. Mobile Browser Behavior

The application must be responsive and optimized for phones.

Prioritize:

- Large speed display
- Large touch targets
- Minimal UI
- Dark mode
- High contrast
- Easy visibility outdoors

It should work well when the phone is mounted on a vehicle.

Do not create a complicated dashboard.

---

# 15. Screen Layout

Use approximately this structure:

```text
┌───────────────────────────────┐
│       GPS SPEED TRACKER       │
│                               │
│          TRACKING ●           │
│                               │
│             62                │
│            km/h               │
│                               │
│     ───────────────────       │
│                               │
│  MAX        AVG        DIST   │
│ 82.7       54.3       12.84   │
│ km/h       km/h        km     │
│                               │
│       TIME  00:27:42          │
│                               │
│       GPS ACCURACY ±8m        │
│          ● Excellent          │
│                               │
│      [ STOP TRACKING ]        │
│                               │
│        [ RESET SESSION ]      │
│                               │
│        Units: km/h ▼          │
└───────────────────────────────┘
```

---

# 16. Architecture

Keep the project modular.

Suggested structure:

```text
src/
├── components/
│   ├── SpeedDisplay.tsx
│   ├── StatsCard.tsx
│   ├── TrackingControls.tsx
│   ├── GPSStatus.tsx
│   └── UnitSelector.tsx
│
├── hooks/
│   └── useGPSTracking.ts
│
├── utils/
│   ├── geo.ts
│   ├── speed.ts
│   └── distance.ts
│
├── types/
│   └── gps.ts
│
├── constants/
│   └── tracking.ts
│
├── App.tsx
└── main.tsx
```

Keep GPS logic separate from UI.

This is important because the GPS tracking logic should later be reusable for the mobile application.

---

# 17. GPS Tracking Hook

Create:

```text
useGPSTracking()
```

It should expose something similar to:

```typescript
{
    isTracking,
    currentSpeed,
    maxSpeed,
    averageSpeed,
    distance,
    duration,
    accuracy,
    gpsStatus,
    startTracking,
    stopTracking,
    resetTracking
}
```

Keep implementation clean and testable.

---

# 18. Data Model

Define a GPS point:

```typescript
interface GPSPoint {
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number;
    speed?: number | null;
}
```

Create appropriate types for:

```text
TrackingStatus
SpeedUnit
TrackingSession
GPSPoint
```

---

# 19. Browser Compatibility

Check:

```javascript
if (!navigator.geolocation)
```

and show a proper error message if unsupported.

Use:

```javascript
navigator.geolocation.watchPosition()
```

with appropriate options.

Start with:

```javascript
{
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000
}
```

Make these configurable.

---

# 20. Security / Privacy

Do not send GPS coordinates to any server.

The application should clearly indicate:

```text
Your location data stays on this device.
```

No analytics or location tracking backend should be added.

---

# 21. Important GPS Reality

Do not claim that GPS speed is perfectly accurate.

Display the GPS accuracy so the user understands the quality of the measurement.

Handle:

- GPS drift
- Poor signal
- Indoor usage
- Stationary GPS movement
- Sudden GPS jumps
- Null speed values
- Permission failures

gracefully.

---

# 22. Testing

Create tests for:

### Haversine distance

Test known coordinates.

### Speed conversion

Test:

```text
1 m/s = 3.6 km/h
10 m/s = 36 km/h
```

### Unit conversion

Test km/h ↔ mph ↔ m/s.

### GPS smoothing

Test multiple speed readings.

### Outlier filtering

Test unrealistic GPS speed spikes.

### Session statistics

Test:

```text
distance
average speed
maximum speed
duration
moving time
```

---

# 23. Developer Experience

Create:

```text
README.md
```

including:

- Installation
- Development
- Build
- Production preview
- Browser GPS requirements
- HTTPS requirement
- Mobile testing instructions

The app should run with:

```bash
npm install
npm run dev
```

and build with:

```bash
npm run build
```

---

# 24. Future Mobile-App Preparation

Do NOT implement the mobile application now.

However, structure the code so the following can later be extracted into a shared package:

```text
GPS point processing
Distance calculation
Speed calculation
Speed smoothing
Outlier filtering
Session statistics
Unit conversion
```

The future mobile application will likely use:

```text
React Native + Expo
```

and native location APIs.

Do not use browser-specific APIs inside the core calculation utilities.

---

# 25. Final Requirements

Build the complete working application.

Do not merely generate a mockup.

The GPS tracking must actually work in a browser that supports geolocation.

Before finishing:

1. Install dependencies.
2. Run the development server.
3. Verify the application loads.
4. Check for TypeScript errors.
5. Check for console errors.
6. Test the UI on a mobile-sized viewport.
7. Test GPS permission handling.
8. Test starting/stopping tracking.
9. Test unit switching.
10. Test resetting a session.

Fix all errors before completing the task.

Keep the first version intentionally simple.

The main objective is:

**Open website → Allow GPS → Start Tracking → See real-time travelling speed and statistics.**