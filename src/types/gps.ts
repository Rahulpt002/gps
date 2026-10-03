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
}

export type SpeedUnit = 'kmh' | 'mph' | 'mps';

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
