import type { AccuracyThresholds, SpeedUnit, TrackingConfig, WatchOptions } from '../types/gps';

export const MPS_TO_KMH = 3.6;
export const MPS_TO_MPH = 2.236936;

/** GPS accuracy quality thresholds in meters. */
export const ACCURACY_THRESHOLDS: AccuracyThresholds = {
  excellent: 10,
  good: 25,
  fair: 50,
};

/** Fixes worse than this (meters) are ignored for distance/speed stats. */
export const MAX_ACCEPTABLE_ACCURACY = 50;

/** Below this speed the user is considered stopped. */
export const STOP_SPEED_THRESHOLD_KMH = 1;

export const DEFAULT_TRACKING_CONFIG: TrackingConfig = {
  smoothingFactor: 0.3,
  maxAcceptableAccuracy: MAX_ACCEPTABLE_ACCURACY,
  stopSpeedThresholdMps: STOP_SPEED_THRESHOLD_KMH / MPS_TO_KMH,
  maxPlausibleSpeedMps: 350 / MPS_TO_KMH, // ~350 km/h
  maxAccelerationMps2: 12, // ~1.2 g – beyond nearly every road vehicle
  maxConsecutiveRejections: 3,
  minMovementMeters: 3,
  accuracyMovementFactor: 0.5,
  maxAnchorAgeSeconds: 10,
};

/** Options passed to the platform location watcher. */
export const DEFAULT_WATCH_OPTIONS: WatchOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000,
  timeout: 10000,
};

/** No fix for this long while tracking → signal considered lost. */
export const SIGNAL_STALE_AFTER_MS = 10000;

/** UI refresh interval for the timer. */
export const UI_TICK_MS = 500;

export const UNIT_LABELS: Record<SpeedUnit, string> = {
  kmh: 'km/h',
  mph: 'mph',
  mps: 'm/s',
};

/** Speedometer gauge full-scale steps per unit. */
export const GAUGE_SCALES: Record<SpeedUnit, number[]> = {
  kmh: [60, 120, 180, 240, 300, 360],
  mph: [40, 80, 120, 160, 200, 240],
  mps: [20, 40, 60, 80, 100],
};
