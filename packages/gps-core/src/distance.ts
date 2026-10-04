import type { SpeedUnit, TrackingConfig } from './types/gps';

export const METERS_PER_MILE = 1609.344;

/**
 * Minimum displacement (m) between two fixes before it counts as real movement.
 * Scales with the worse of the two accuracy radii to suppress stationary drift.
 */
export function movementThreshold(
  accuracyA: number | undefined,
  accuracyB: number | undefined,
  config: Pick<TrackingConfig, 'minMovementMeters' | 'accuracyMovementFactor'>,
): number {
  const worst = Math.max(accuracyA ?? 0, accuracyB ?? 0);
  return Math.max(config.minMovementMeters, worst * config.accuracyMovementFactor);
}

/** Distance unit that pairs with a speed unit. */
export function distanceUnitFor(unit: SpeedUnit): 'km' | 'mi' {
  return unit === 'mph' ? 'mi' : 'km';
}

/** Convert meters to km or miles depending on the selected speed unit. */
export function convertDistance(meters: number, unit: SpeedUnit): number {
  return unit === 'mph' ? meters / METERS_PER_MILE : meters / 1000;
}
