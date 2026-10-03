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
