import { SPEED_CATEGORIES, UNIT_LABELS } from '@gps/core';
import type { SpeedCategory, SpeedUnit, TrackPoint } from '@gps/core';
import { convertSpeed } from '@gps/core';

/** Format milliseconds as HH:MM:SS. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(decimals);
}

/** Distances under 10 units get two decimals, otherwise one. */
export function formatDistanceValue(value: number): string {
  return formatNumber(value, value < 10 ? 2 : 1);
}

// ---------------------------------------------------------------------------
// Unit-aware presentation (convert from canonical m/s only here)
// ---------------------------------------------------------------------------

/** Speed (m/s) → number string in the selected unit. */
export function formatSpeed(mps: number, unit: SpeedUnit, decimals = 1): string {
  return formatNumber(convertSpeed(mps, unit), decimals);
}

/** Speed (m/s) → "67.4 km/h". */
export function formatSpeedWithUnit(mps: number, unit: SpeedUnit, decimals = 1): string {
  return `${formatSpeed(mps, unit, decimals)} ${UNIT_LABELS[unit]}`;
}

/** Local wall-clock time, 24h, e.g. "14:32:18". */
export function formatClockTime(timestamp: number, withSeconds = true): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return withSeconds
    ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface DetailRow {
  label: string;
  value: string;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Rows shown in the track-point popup. Missing device data is reported as
 * "Unavailable" (altitude) or omitted (heading) – never invented.
 */
export function describeTrackPoint(point: TrackPoint, unit: SpeedUnit): DetailRow[] {
  const rows: DetailRow[] = [
    { label: 'SPEED', value: formatSpeedWithUnit(point.speed, unit) },
    { label: 'GPS ACCURACY', value: point.accuracy !== null ? `±${Math.round(point.accuracy)} m` : 'Unavailable' },
    { label: 'TIME', value: formatClockTime(point.timestamp) },
    { label: 'COORDINATES', value: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` },
    { label: 'ALTITUDE', value: point.altitude !== null ? `${Math.round(point.altitude)} m` : 'Unavailable' },
  ];
  if (point.heading !== null) {
    const h = ((point.heading % 360) + 360) % 360;
    rows.push({ label: 'HEADING', value: `${Math.round(h)}° ${COMPASS[Math.round(h / 45) % 8]}` });
  }
  return rows;
}

export interface LegendItem {
  key: SpeedCategory['key'];
  color: string;
  label: string;
}

function formatThreshold(mps: number, unit: SpeedUnit): string {
  const v = convertSpeed(mps, unit);
  if (v === 0) return '0';
  return unit === 'mps' ? v.toFixed(1) : String(Math.round(v));
}

/** Legend rows with thresholds converted to the selected unit. */
export function getLegendItems(unit: SpeedUnit, categories: SpeedCategory[] = SPEED_CATEGORIES): LegendItem[] {
  return categories.map((c) => ({
    key: c.key,
    color: c.color,
    label:
      c.maxMps === null
        ? `${formatThreshold(c.minMps, unit)}+ ${UNIT_LABELS[unit]}`
        : `${formatThreshold(c.minMps, unit)}–${formatThreshold(c.maxMps, unit)} ${UNIT_LABELS[unit]}`,
  }));
}
