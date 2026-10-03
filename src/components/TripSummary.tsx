import { UNIT_LABELS } from '../constants/tracking';
import type { SpeedUnit } from '../types/gps';
import { convertDistance, distanceUnitFor } from '../utils/distance';
import { formatDistanceValue, formatDuration, formatSpeed } from '../utils/format';

interface TripSummaryProps {
  distanceMeters: number;
  movingTimeMs: number;
  totalTimeMs: number;
  averageSpeedMps: number;
  maxSpeedMps: number;
  pointCount: number;
  unit: SpeedUnit;
}

export function TripSummary(props: TripSummaryProps) {
  const { unit } = props;
  const items = [
    { label: 'Distance', value: formatDistanceValue(convertDistance(props.distanceMeters, unit)), unit: distanceUnitFor(unit) },
    { label: 'Moving Time', value: formatDuration(props.movingTimeMs) },
    { label: 'Total Time', value: formatDuration(props.totalTimeMs) },
    { label: 'Average Speed', value: formatSpeed(props.averageSpeedMps, unit), unit: UNIT_LABELS[unit] },
    { label: 'Maximum Speed', value: formatSpeed(props.maxSpeedMps, unit), unit: UNIT_LABELS[unit] },
    { label: 'GPS Points', value: props.pointCount.toLocaleString() },
  ];

  return (
    <section className="summary" id="trip-summary" aria-labelledby="trip-summary-title">
      <h2 className="summary__title" id="trip-summary-title">
        TRIP SUMMARY
      </h2>
      <dl className="summary__grid">
        {items.map((i) => (
          <div key={i.label} className="summary__item">
            <dt>{i.label}</dt>
            <dd>
              <span className="summary__value">{i.value}</span>
              {i.unit && <span className="summary__unit">{i.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
