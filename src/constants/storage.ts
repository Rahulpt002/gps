/** Storage and recovery constants. */

/** How often (ms) to persist the active session draft to IndexedDB. */
export const DRAFT_SAVE_INTERVAL_MS = 15_000;

/** Elevation noise dead-band threshold in meters. */
export const ELEVATION_THRESHOLD_METERS = 3;

/** localStorage key for the selected speed unit. */
export const UNIT_STORAGE_KEY = 'gps-speed-tracker:unit';
