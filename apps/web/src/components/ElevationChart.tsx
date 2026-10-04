/**
 * SVG elevation profile chart.
 * Similar structure to SpeedChart but plots altitude over distance.
 */
import { memo, useId, useMemo, useRef, useState, useEffect, type PointerEvent } from 'react';
import type { TrackPoint, TrackSelection } from '@gps/core';
import { haversineDistance } from '@gps/core';
import { formatClockTime } from '../utils/format';
import { downsampleIndices } from '../utils/route';

interface ElevationChartProps {
  points: TrackPoint[];
  selection: TrackSelection | null;
  onSelect: (index: number | null, source: TrackSelection['source']) => void;
}

const HEIGHT = 130;
const PAD = { left: 42, right: 12, top: 14, bottom: 22 };
const MAX_CHART_POINTS = 600;

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Compute cumulative distance at each point index. */
function cumulativeDistances(points: TrackPoint[]): number[] {
  const d = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const seg = prev.segment === curr.segment ? haversineDistance(prev, curr) : 0;
    d.push(d[i - 1]! + seg);
  }
  return d;
}

export const ElevationChart = memo(function ElevationChart({ points, selection, onSelect }: ElevationChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const gradientId = useId().replace(/:/g, '');

  // Filter to points with altitude.
  const validCount = useMemo(() => points.filter((p) => p.altitude !== null).length, [points]);

  const geom = useMemo(() => {
    if (validCount < 2 || width <= 0) return null;
    const plotW = Math.max(10, width - PAD.left - PAD.right);
    const plotH = HEIGHT - PAD.top - PAD.bottom;

    const distances = cumulativeDistances(points);
    const totalDist = distances[distances.length - 1]!;
    if (totalDist <= 0) return null;

    let minAlt = Infinity;
    let maxAlt = -Infinity;
    for (const p of points) {
      if (p.altitude !== null) {
        if (p.altitude < minAlt) minAlt = p.altitude;
        if (p.altitude > maxAlt) maxAlt = p.altitude;
      }
    }
    const range = Math.max(10, maxAlt - minAlt);
    const padded = range * 0.1;
    const altMin = minAlt - padded;
    const altMax = maxAlt + padded;
    const altRange = altMax - altMin;

    const x = (dist: number) => PAD.left + (dist / totalDist) * plotW;
    const y = (alt: number) => PAD.top + plotH * (1 - (alt - altMin) / altRange);
    const baseline = PAD.top + plotH;

    let line = '';
    let area = '';
    let started = false;
    for (const i of downsampleIndices(points, MAX_CHART_POINTS)) {
      const p = points[i]!;
      if (p.altitude === null) continue;
      const px = x(distances[i]!).toFixed(1);
      const py = y(p.altitude).toFixed(1);
      if (!started) {
        line += `M${px},${py}`;
        area += `M${px},${baseline}L${px},${py}`;
        started = true;
      } else {
        line += `L${px},${py}`;
        area += `L${px},${py}`;
      }
    }
    if (started) {
      const lastDist = distances[distances.length - 1]!;
      area += `L${x(lastDist).toFixed(1)},${baseline}Z`;
    }

    const gridSteps = 4;
    const grid = Array.from({ length: gridSteps }, (_, k) => {
      const frac = (k + 1) / gridSteps;
      const alt = altMin + frac * altRange;
      return { value: Math.round(alt), y: PAD.top + plotH * (1 - frac) };
    });

    return { x, y, distances, totalDist, baseline, line, area, grid, altMin, altMax };
  }, [points, validCount, width]);

  const selected = selection && points[selection.index] ? { i: selection.index, p: points[selection.index]! } : null;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!geom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left - PAD.left) / (width - PAD.left - PAD.right);
    const targetDist = Math.max(0, Math.min(1, frac)) * geom.totalDist;
    // Find nearest point by cumulative distance.
    let best = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < geom.distances.length; i++) {
      const delta = Math.abs(geom.distances[i]! - targetDist);
      if (delta < bestDelta) { bestDelta = delta; best = i; }
    }
    onSelect(best, 'chart');
  };

  if (validCount < 2) return null;

  return (
    <div className="chart" ref={wrapRef} id="elevation-chart">
      <div className="chart__header">
        <span className="chart__title">ELEVATION</span>
        {selected && selected.p.altitude !== null ? (
          <span className="chart__readout">
            <strong>{Math.round(selected.p.altitude)} m</strong> · {formatClockTime(selected.p.timestamp)}
          </span>
        ) : (
          geom && (
            <span className="chart__readout muted">
              {Math.round(geom.totalDist / 1000 * 10) / 10} km
            </span>
          )
        )}
      </div>

      {!geom ? (
        <div className="chart__empty" style={{ height: HEIGHT }}>
          Elevation profile appears here when altitude data is available.
        </div>
      ) : (
        <svg
          className="chart__svg"
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Elevation profile"
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerLeave={(e) => e.pointerType === 'mouse' && onSelect(null, 'chart')}
        >
          <defs>
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1={geom.baseline} x2="0" y2={PAD.top}>
              <stop offset="0%" stopColor="hsl(32, 80%, 45%)" />
              <stop offset="100%" stopColor="hsl(120, 60%, 50%)" />
            </linearGradient>
          </defs>

          {geom.grid.map((g) => (
            <g key={g.value}>
              <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={g.y} y2={g.y} />
              <text className="chart__axis" x={PAD.left - 6} y={g.y + 3} textAnchor="end">
                {g.value}m
              </text>
            </g>
          ))}
          <line className="chart__grid chart__grid--base" x1={PAD.left} x2={width - PAD.right} y1={geom.baseline} y2={geom.baseline} />

          <path d={geom.area} fill={`url(#${gradientId})`} opacity={0.18} />
          <path d={geom.line} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2} strokeLinejoin="round" />

          <text className="chart__axis" x={PAD.left} y={HEIGHT - 6} textAnchor="start">0 km</text>
          <text className="chart__axis" x={width - PAD.right} y={HEIGHT - 6} textAnchor="end">
            {(geom.totalDist / 1000).toFixed(1)} km
          </text>

          {selected && selected.p.altitude !== null && (
            <g className="chart__cursor">
              <line
                x1={geom.x(geom.distances[selected.i]!)}
                x2={geom.x(geom.distances[selected.i]!)}
                y1={PAD.top}
                y2={geom.baseline}
              />
              <circle
                cx={geom.x(geom.distances[selected.i]!)}
                cy={geom.y(selected.p.altitude)}
                r={5}
              />
            </g>
          )}
        </svg>
      )}
    </div>
  );
});
