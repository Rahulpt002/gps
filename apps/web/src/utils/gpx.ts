/**
 * GPX generation and parsing. No external dependencies — uses native
 * DOMParser / XMLSerializer.
 */
import type { TrackPoint } from '@gps/core';
import type { Trip } from '@gps/core';
import { computeElevation } from '@gps/core';
import { ELEVATION_THRESHOLD_METERS } from '../constants/storage';

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function isoTime(ts: number): string {
  return new Date(ts).toISOString();
}

/** Generate a valid GPX 1.1 XML string from a Trip. */
export function generateGPX(trip: Trip): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="GPS Speed Tracker"',
    '  xmlns="http://www.topografix.com/GPX/1/1"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${escapeXml(trip.name)}</name>`,
    `    <time>${isoTime(trip.startedAt)}</time>`,
    '  </metadata>',
    '  <trk>',
    `    <name>${escapeXml(trip.name)}</name>`,
  ];

  let currentSegment: number | null = null;
  for (const pt of trip.points) {
    if (pt.segment !== currentSegment) {
      if (currentSegment !== null) lines.push('    </trkseg>');
      lines.push('    <trkseg>');
      currentSegment = pt.segment;
    }
    lines.push(`      <trkpt lat="${pt.latitude.toFixed(7)}" lon="${pt.longitude.toFixed(7)}">`);
    if (pt.altitude !== null) {
      lines.push(`        <ele>${pt.altitude.toFixed(1)}</ele>`);
    }
    lines.push(`        <time>${isoTime(pt.timestamp)}</time>`);
    if (pt.speed > 0) {
      lines.push(`        <extensions><speed>${pt.speed.toFixed(2)}</speed></extensions>`);
    }
    lines.push('      </trkpt>');
  }
  if (currentSegment !== null) lines.push('    </trkseg>');
  lines.push('  </trk>');
  lines.push('</gpx>');
  return lines.join('\n');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Trigger a browser download of the GPX file. */
export function downloadGPX(trip: Trip): void {
  const xml = generateGPX(trip);
  const blob = new Blob([xml], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const d = new Date(trip.startedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const filename = `gps-trip-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.gpx`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Parse a GPX XML string into a partial Trip. */
export function parseGPX(xml: string): Trip {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) throw new Error('Invalid GPX: XML parse error');

  const ns = 'http://www.topografix.com/GPX/1/1';
  const nameEl = doc.getElementsByTagNameNS(ns, 'name')[0];
  const trksegs = doc.getElementsByTagNameNS(ns, 'trkseg');
  if (trksegs.length === 0) throw new Error('Invalid GPX: no track segments found');

  const points: TrackPoint[] = [];
  let segment = 0;
  let hasSpeed = false;

  for (let s = 0; s < trksegs.length; s++) {
    const seg = trksegs[s]!;
    const trkpts = seg.getElementsByTagNameNS(ns, 'trkpt');
    for (let i = 0; i < trkpts.length; i++) {
      const pt = trkpts[i]!;
      const lat = parseFloat(pt.getAttribute('lat') ?? '');
      const lon = parseFloat(pt.getAttribute('lon') ?? '');
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const eleEl = pt.getElementsByTagNameNS(ns, 'ele')[0];
      const timeEl = pt.getElementsByTagNameNS(ns, 'time')[0];
      const speedEl = pt.querySelector('extensions > speed');

      const altitude = eleEl ? parseFloat(eleEl.textContent ?? '') : null;
      const timestamp = timeEl ? new Date(timeEl.textContent ?? '').getTime() : 0;
      const speed = speedEl ? parseFloat(speedEl.textContent ?? '') : 0;
      if (speed > 0) hasSpeed = true;

      points.push({
        latitude: lat,
        longitude: lon,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        speed: Number.isFinite(speed) ? speed : 0,
        accuracy: null,
        altitude: altitude !== null && Number.isFinite(altitude) ? altitude : null,
        heading: null,
        segment,
      });
    }
    segment++;
  }

  if (points.length === 0) throw new Error('Invalid GPX: no valid track points found');

  // Sort by timestamp if timestamps are available.
  if (points[0]!.timestamp > 0) {
    points.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Compute stats from imported points.
  const startedAt = points[0]!.timestamp || Date.now();
  const endedAt = points[points.length - 1]!.timestamp || Date.now();
  const durationMs = endedAt - startedAt;

  let distanceMeters = 0;
  let movingTimeMs = 0;
  let maxSpeedMps = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.segment !== b.segment) continue;
    const dlat = (b.latitude - a.latitude) * 111195;
    const dlon = (b.longitude - a.longitude) * 111195 * Math.cos((a.latitude * Math.PI) / 180);
    const d = Math.sqrt(dlat * dlat + dlon * dlon);
    distanceMeters += d;
    if (b.speed > maxSpeedMps) maxSpeedMps = b.speed;
    const dt = b.timestamp - a.timestamp;
    if (dt > 0 && b.speed > 0.278) movingTimeMs += dt; // > 1 km/h
  }

  const averageSpeedMps = movingTimeMs > 1000 ? distanceMeters / (movingTimeMs / 1000) : 0;
  const elev = computeElevation(points, ELEVATION_THRESHOLD_METERS);

  const importName = nameEl?.textContent?.trim() || `Imported GPX — ${new Date(startedAt).toLocaleDateString()}`;

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    name: importName + (hasSpeed ? '' : ' (no speed data)'),
    startedAt,
    endedAt,
    durationMs,
    movingTimeMs,
    distanceMeters,
    averageSpeedMps,
    maxSpeedMps,
    pointCount: points.length,
    startLat: points[0]!.latitude,
    startLng: points[0]!.longitude,
    endLat: points[points.length - 1]!.latitude,
    endLng: points[points.length - 1]!.longitude,
    elevationGainMeters: elev?.gainMeters ?? null,
    elevationLossMeters: elev?.lossMeters ?? null,
    highestAltitudeMeters: elev?.highestMeters ?? null,
    lowestAltitudeMeters: elev?.lowestMeters ?? null,
    points,
  };
}
