import type {
  AccuracyThresholds,
  SpeedCategory,
  SpeedCategoryKey,
  SpeedUnit,
  TrackingConfig,
  WatchOptions,
} from '../types/gps';

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

// ---------------------------------------------------------------------------
// Map & route visualisation
// ---------------------------------------------------------------------------

/**
 * Route colour bands (km/h lower bounds). Purely visual categories –
 * NOT legal speed limits. Edit freely.
 */
export const SPEED_THRESHOLDS_KMH: Record<Exclude<SpeedCategoryKey, 'slow'>, number> = {
  moderate: 20,
  fast: 40,
  veryFast: 60,
  extreme: 80,
};

export const SPEED_COLORS: Record<SpeedCategoryKey, string> = {
  slow: '#2ee6a0',
  moderate: '#d8f04a',
  fast: '#ffb340',
  veryFast: '#ff5a6e',
  extreme: '#c26bff',
};

const kmh = (v: number) => v / MPS_TO_KMH;

/** Ordered speed categories derived from the thresholds above (bounds in m/s). */
export const SPEED_CATEGORIES: SpeedCategory[] = [
  { key: 'slow', label: 'Slow', minMps: 0, maxMps: kmh(SPEED_THRESHOLDS_KMH.moderate), color: SPEED_COLORS.slow },
  {
    key: 'moderate',
    label: 'Moderate',
    minMps: kmh(SPEED_THRESHOLDS_KMH.moderate),
    maxMps: kmh(SPEED_THRESHOLDS_KMH.fast),
    color: SPEED_COLORS.moderate,
  },
  {
    key: 'fast',
    label: 'Fast',
    minMps: kmh(SPEED_THRESHOLDS_KMH.fast),
    maxMps: kmh(SPEED_THRESHOLDS_KMH.veryFast),
    color: SPEED_COLORS.fast,
  },
  {
    key: 'veryFast',
    label: 'Very fast',
    minMps: kmh(SPEED_THRESHOLDS_KMH.veryFast),
    maxMps: kmh(SPEED_THRESHOLDS_KMH.extreme),
    color: SPEED_COLORS.veryFast,
  },
  { key: 'extreme', label: 'Extreme', minMps: kmh(SPEED_THRESHOLDS_KMH.extreme), maxMps: null, color: SPEED_COLORS.extreme },
];

/** Map/chart re-render at most this often. GPS sampling is unaffected. */
export const MAP_RENDER_INTERVAL_MS = 1000;

/** Above this many points, route geometry is simplified for rendering only. */
export const ROUTE_SIMPLIFY_MIN_POINTS = 1500;
export const ROUTE_SIMPLIFY_TOLERANCE_METERS = 4;

/** Small per-sample dots: only when zoomed in, capped for performance. */
export const MAP_POINT_DOTS_MIN_ZOOM = 15;
export const MAP_MAX_POINT_DOTS = 300;
/** Tap tolerance when picking a sample on the map. */
export const MAP_POINT_HIT_RADIUS_PX = 24;

export const MAP_FOLLOW_ZOOM = 17;
export const MAP_DEFAULT_CENTER: [number, number] = [20, 0];
export const MAP_DEFAULT_ZOOM = 2;

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

/** Max samples drawn in the speed chart (downsampled, peaks preserved). */
export const CHART_MAX_POINTS = 600;
