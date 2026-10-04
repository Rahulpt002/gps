import { GAUGE_SCALES, UNIT_LABELS } from '@gps/core';
import type { SpeedUnit } from '@gps/core';
import { convertSpeed } from '@gps/core';

interface SpeedDisplayProps {
  speedMps: number;
  maxSpeedMps: number;
  unit: SpeedUnit;
  active: boolean;
  stale: boolean;
}

const SIZE = 320;
const VIEW_HEIGHT = 296; // crop the empty bottom of the 270° arc
const CENTER = SIZE / 2;
const RADIUS = 138;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SWEEP = 0.75; // 270° arc
const START_ANGLE = 135; // degrees, measured clockwise from +x
const TICKS = 30;

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a) };
}

function formatSpeed(value: number): string {
  return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
}

export function SpeedDisplay({ speedMps, maxSpeedMps, unit, active, stale }: SpeedDisplayProps) {
  const value = convertSpeed(speedMps, unit);
  const maxValue = convertSpeed(maxSpeedMps, unit);
  const scales = GAUGE_SCALES[unit];
  const scale = scales.find((s) => s >= Math.max(value, maxValue)) ?? scales[scales.length - 1]!;
  const fraction = Math.min(1, value / scale);
  const maxFraction = Math.min(1, maxValue / scale);
  const arcLength = CIRCUMFERENCE * SWEEP;
  const maxMarker = polar(START_ANGLE + 270 * maxFraction, RADIUS);

  return (
    <section
      className={`speed ${active ? 'speed--active' : ''} ${stale ? 'speed--stale' : ''}`}
      aria-label="Current speed"
    >
      <svg className="speed__gauge" viewBox={`0 0 ${SIZE} ${VIEW_HEIGHT}`} aria-hidden="true">
        <defs>
          <linearGradient id="gaugeGradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-2)" />
            <stop offset="60%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-hot)" />
          </linearGradient>
          <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const angle = START_ANGLE + (270 * i) / TICKS;
          const major = i % 5 === 0;
          const outer = polar(angle, RADIUS - 18);
          const inner = polar(angle, RADIUS - (major ? 32 : 25));
          const lit = i / TICKS <= fraction && fraction > 0;
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={`speed__tick ${major ? 'speed__tick--major' : ''} ${lit ? 'speed__tick--lit' : ''}`}
            />
          );
        })}

        <circle
          className="speed__track"
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          strokeDasharray={`${arcLength} ${CIRCUMFERENCE}`}
          transform={`rotate(${START_ANGLE} ${CENTER} ${CENTER})`}
        />
        {fraction > 0 && (
          <circle
            className="speed__value"
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke="url(#gaugeGradient)"
            filter="url(#gaugeGlow)"
            strokeDasharray={`${arcLength * fraction} ${CIRCUMFERENCE}`}
            transform={`rotate(${START_ANGLE} ${CENTER} ${CENTER})`}
          />
        )}
        {maxFraction > 0 && <circle className="speed__max-marker" cx={maxMarker.x} cy={maxMarker.y} r={6} />}

        <text className="speed__scale" x={polar(START_ANGLE, RADIUS).x} y={VIEW_HEIGHT - 6} textAnchor="middle">
          0
        </text>
        <text className="speed__scale" x={polar(START_ANGLE + 270, RADIUS).x} y={VIEW_HEIGHT - 6} textAnchor="middle">
          {scale}
        </text>
      </svg>

      <div className="speed__readout">
        <div className="speed__number" aria-live="off" data-testid="current-speed">
          {formatSpeed(value)}
        </div>
        <div className="speed__unit">{UNIT_LABELS[unit]}</div>
        <div className="speed__label">{stale ? 'NO GPS SIGNAL' : 'CURRENT SPEED'}</div>
      </div>
    </section>
  );
}
