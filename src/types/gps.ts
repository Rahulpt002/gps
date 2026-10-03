/**
 * Platform-agnostic GPS types. Nothing in this file may depend on browser APIs
 * so it can be shared with a future React Native / Expo app.
 */

/** A single location fix. Speed and accuracy are in SI units (m/s, meters). */
export interface GPSPoint {
  latitude: number;
  longitude: number;
  /** Epoch milliseconds. */
  timestamp: number;
  /** Horizontal accuracy radius in meters. */
  accuracy?: number;
  /** Device-reported ground speed in m/s (often null in browsers). */
  speed?: number | null;
  /** Meters above the WGS84 ellipsoid, when the device provides it. */
  altitude?: number | null;
  /** Degrees clockwise from true north, when the device provides it. */
  heading?: number | null;
}

/**
 * One ACCEPTED tracking sample: coordinate + timestamp + accuracy + speed.
 * `speed` is the engine's accepted raw/derived speed in m/s (not the smoothed
 * display speed), so each sample is an individual measurement.
 */
export interface TrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  /** Accepted speed in m/s at this sample. */
  speed: number;
  /** Accuracy radius in meters, null if the device didn't report one. */
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  /**
   * Continuous-route segment id. Increments on stop → resume and on resync,
   * so the route is never drawn across a gap that wasn't measured.
   */
  segment: number;
}

export type SpeedCategoryKey = 'slow' | 'moderate' | 'fast' | 'veryFast' | 'extreme';

/** A visualization band for route colouring. Not a legal speed limit. */
export interface SpeedCategory {
  key: SpeedCategoryKey;
  label: string;
  /** Inclusive lower bound in m/s. */
  minMps: number;
  /** Exclusive upper bound in m/s; null = no upper bound. */
  maxMps: number | null;
  color: string;
}

export type SpeedUnit = 'kmh' | 'mph' | 'mps';

/** Which sample is highlighted, and which view initiated it (map ↔ chart sync). */
export interface TrackSelection {
  index: number;
  source: 'map' | 'chart';
}

/** High-level state shown in the status pill. */
export type TrackingStatus =
  | 'ready' // idle, GPS available
  | 'acquiring' // tracking requested, waiting for first fix
  | 'tracking' // receiving good fixes
  | 'weak' // fixes are inaccurate, timing out, or stale
  | 'error' // permission denied / position unavailable
  | 'unsupported'; // no geolocation in this environment

export type AccuracyQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export type GPSErrorKind =
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | 'unsupported'
  | 'insecure-context'
  | 'unknown';

export interface GPSError {
  kind: GPSErrorKind;
  message: string;
}

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface AccuracyThresholds {
  /** accuracy < excellent → Excellent */
  excellent: number;
  /** accuracy < good → Good */
  good: number;
  /** accuracy <= fair → Fair, otherwise Poor */
  fair: number;
}

/** Tunables for point processing. All speeds in m/s, distances in meters. */
export interface TrackingConfig {
  /** EMA weight for the newest reading (0..1). Higher = more responsive. */
  smoothingFactor: number;
  /** Fixes with a worse accuracy radius than this are ignored for stats. */
  maxAcceptableAccuracy: number;
  /** Below this speed the user is considered stopped. */
  stopSpeedThresholdMps: number;
  /** Any reading above this speed is treated as a GPS glitch. */
  maxPlausibleSpeedMps: number;
  /** Max believable change in speed per second between samples. */
  maxAccelerationMps2: number;
  /** After this many rejections in a row, resync to the latest fix. */
  maxConsecutiveRejections: number;
  /** Minimum displacement before movement counts (filters stationary drift). */
  minMovementMeters: number;
  /** Movement must also exceed accuracy × this factor. */
  accuracyMovementFactor: number;
  /** While stationary, re-anchor after this many seconds to bound drift. */
  maxAnchorAgeSeconds: number;
}

/** Accumulated statistics for one tracking session. */
export interface TrackingSession {
  distanceMeters: number;
  movingTimeMs: number;
  maxSpeedMps: number;
  /** Smoothed speed for display. */
  currentSpeedMps: number;
  /** Last accepted unsmoothed speed (used for outlier detection). */
  lastRawSpeedMps: number;
  /** Last point where significant movement was registered. */
  anchor: GPSPoint | null;
  /** Last accepted sample. */
  lastSample: GPSPoint | null;
  /** Most recent accuracy reading, accepted or not. */
  lastAccuracy: number | null;
  consecutiveRejections: number;
  acceptedPoints: number;
  rejectedPoints: number;
  /** Every accepted sample, in order. Rejected fixes never appear here. */
  trackPoints: TrackPoint[];
  /** Segment id assigned to newly accepted points. */
  segmentIndex: number;
}

export type PointRejectionReason = 'invalid' | 'low-accuracy' | 'stale' | 'outlier';

export interface ProcessResult {
  session: TrackingSession;
  accepted: boolean;
  reason?: PointRejectionReason;
}

/** Wall-clock stopwatch state. */
export interface SessionTimer {
  accumulatedMs: number;
  /** Epoch ms when the current running segment started, or null if stopped. */
  runningSince: number | null;
}

export interface WatchOptions {
  enableHighAccuracy: boolean;
  maximumAge: number;
  timeout: number;
}
