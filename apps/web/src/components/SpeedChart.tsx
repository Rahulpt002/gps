/**
 * Lightweight SVG speed-over-time chart (no chart library).
 * Plots accepted samples only; lines connect samples within a segment and
 * break across stop/resume gaps. Peaks are preserved when downsampling.
 */
import { memo, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { CHART_MAX_POINTS, SPEED_CATEGORIES, UNIT_LABELS } from '@gps/core';
import type { SpeedUnit, TrackPoint, TrackSelection } from '@gps/core';
import { formatClockTime, formatDuration, formatSpeedWithUnit } from '../utils/format';
import { downsampleIndices, findIndexByTime } from '../utils/route';
import { convertSpeed } from '@gps/core';

interface SpeedChartProps {
  points: TrackPoint[];
  unit: SpeedUnit;
  selection: TrackSelection | null;
  onSelect: (index: number | null, source: TrackSelection['source']) => void;
}

const HEIGHT = 150;
const PAD = { left: 36, right: 12, top: 14, bottom: 22 };
const NICE_STEPS = [5, 10, 20, 30, 40, 60, 80, 100, 120, 150, 200, 250, 300, 400];

function niceMax(v: number, unit: SpeedUnit): number {
  const floor = unit === 'mps' ? 5 : 20;
  const target = Math.max(floor, v * 1.1);
  return NICE_STEPS.find((s) => s >= target) ?? Math.ceil(target / 100) * 100;
}

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

export const SpeedChart = memo(function SpeedChart({ points, unit, selection, onSelect }: SpeedChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const gradientId = useId().replace(/:/g, '');

  const geom = useMemo(() => {
    if (points.length < 2 || width <= 0) return null;
    const plotW = Math.max(10, width - PAD.left - PAD.right);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const t0 = points[0]!.timestamp;
    const t1 = points[points.length - 1]!.timestamp;
    const span = Math.max(1000, t1 - t0);
    let maxMps = 0;
    for (const p of points) if (p.speed > maxMps) maxMps = p.speed;
    const vMax = niceMax(convertSpeed(maxMps, unit), unit);

    const x = (t: number) => PAD.left + ((t - t0) / span) * plotW;
    const y = (mps: number) => PAD.top + plotH * (1 - Math.min(1, convertSpeed(mps, unit) / vMax));
    const baseline = PAD.top + plotH;

    let line = '';
    let area = '';
    let runStartX = 0;
    let lastX = 0;
    let prevSegment: number | null = null;
    for (const i of downsampleIndices(points, CHART_MAX_POINTS)) {
      const p = points[i]!;
      const px = x(p.timestamp).toFixed(1);
      const py = y(p.speed).toFixed(1);
      if (p.segment !== prevSegment) {
        if (prevSegment !== null) area += `L${lastX.toFixed(1)},${baseline}Z`;
        line += `M${px},${py}`;
        area += `M${px},${baseline}L${px},${py}`;
        runStartX = Number(px);
      } else {
        line += `L${px},${py}`;
        area += `L${px},${py}`;
      }
      lastX = Number(px);
      prevSegment = p.segment;
    }
    area += `L${lastX.toFixed(1)},${baseline}L${runStartX.toFixed(1)},${baseline}Z`;

    // Hard-stop gradient so the line uses the same colour bands as the map.
    const stops = SPEED_CATEGORIES.flatMap((c, k) => {
      const from = Math.min(1, convertSpeed(c.minMps, unit) / vMax);
      const next = SPEED_CATEGORIES[k + 1];
      const to = next ? Math.min(1, convertSpeed(next.minMps, unit) / vMax) : 1;
      return from >= 1 ? [] : [
        { offset: from, color: c.color },
        { offset: to, color: c.color },
      ];
    });

    const grid = [0.25, 0.5, 0.75, 1].map((f) => ({ value: vMax * f, y: PAD.top + plotH * (1 - f) }));
    return { x, y, t0, t1, span, plotW, baseline, line, area, stops, grid };
  }, [points, unit, width]);

  const selected = selection && points[selection.index] ? { i: selection.index, p: points[selection.index]! } : null;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!geom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left - PAD.left) / geom.plotW;
    const t = geom.t0 + Math.min(1, Math.max(0, frac)) * geom.span;
    onSelect(findIndexByTime(points, t), 'chart');
  };

  return (
    <div className="chart" ref={wrapRef} id="speed-chart">
      <div className="chart__header">
        <span className="chart__title">SPEED TIMELINE</span>
        {selected ? (
          <span className="chart__readout">
            <strong>{formatSpeedWithUnit(selected.p.speed, unit)}</strong> · {formatClockTime(selected.p.timestamp)}
          </span>
        ) : (
          geom && <span className="chart__readout muted">{formatDuration(geom.t1 - geom.t0)}</span>
        )}
      </div>

      {!geom ? (
        <div className="chart__empty" style={{ height: HEIGHT }}>
          Speed over time appears here once tracking starts.
        </div>
      ) : (
        <svg
          className="chart__svg"
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Speed over time in ${UNIT_LABELS[unit]}`}
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerLeave={(e) => e.pointerType === 'mouse' && onSelect(null, 'chart')}
        >
          <defs>
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1={geom.baseline} x2="0" y2={PAD.top}>
              {geom.stops.map((s, k) => (
                <stop key={k} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>

          {geom.grid.map((g) => (
            <g key={g.value}>
              <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={g.y} y2={g.y} />
              <text className="chart__axis" x={PAD.left - 6} y={g.y + 3} textAnchor="end">
                {Math.round(g.value)}
              </text>
            </g>
          ))}
          <line className="chart__grid chart__grid--base" x1={PAD.left} x2={width - PAD.right} y1={geom.baseline} y2={geom.baseline} />

          <path d={geom.area} fill={`url(#${gradientId})`} opacity={0.16} />
          <path d={geom.line} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2.25} strokeLinejoin="round" />

          <text className="chart__axis" x={PAD.left} y={HEIGHT - 6} textAnchor="start">
            {formatClockTime(geom.t0, false)}
          </text>
          <text className="chart__axis" x={width - PAD.right} y={HEIGHT - 6} textAnchor="end">
            {formatClockTime(geom.t1, false)}
          </text>

          {selected && (
            <g className="chart__cursor">
              <line x1={geom.x(selected.p.timestamp)} x2={geom.x(selected.p.timestamp)} y1={PAD.top} y2={geom.baseline} />
              <circle cx={geom.x(selected.p.timestamp)} cy={geom.y(selected.p.speed)} r={5} />
            </g>
          )}
        </svg>
      )}
    </div>
  );
});
