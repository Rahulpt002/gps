/**
 * Individual trip card in the history list.
 */
import type { SpeedUnit } from '../types/gps';
import type { TripMeta } from '../types/trip';
import { convertDistance, distanceUnitFor } from '../utils/distance';
import { formatDistanceValue, formatDuration, formatSpeed } from '../utils/format';
import { UNIT_LABELS } from '../constants/tracking';

interface TripCardProps {
  trip: TripMeta;
  unit: SpeedUnit;
  onClick: () => void;
}

function formatTripDate(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  const year = d.getFullYear();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} ${month} ${year} · ${time}`;
}

export function TripCard({ trip, unit, onClick }: TripCardProps) {
  const unitLabel = UNIT_LABELS[unit];
  return (
    <button type="button" className="trip-card" onClick={onClick} aria-label={trip.name}>
      <div className="trip-card__header">
        <span className="trip-card__name">{trip.name}</span>
        <span className="trip-card__date">{formatTripDate(trip.startedAt)}</span>
      </div>
      <div className="trip-card__stats">
        <div className="trip-card__stat">
          <span className="trip-card__value">
            {formatDistanceValue(convertDistance(trip.distanceMeters, unit))}
          </span>
          <span className="trip-card__unit">{distanceUnitFor(unit)}</span>
        </div>
        <div className="trip-card__stat">
          <span className="trip-card__value">{formatSpeed(trip.averageSpeedMps, unit)}</span>
          <span className="trip-card__unit">{unitLabel} avg</span>
        </div>
        <div className="trip-card__stat">
          <span className="trip-card__value">{formatSpeed(trip.maxSpeedMps, unit)}</span>
          <span className="trip-card__unit">{unitLabel} max</span>
        </div>
        <div className="trip-card__stat">
          <span className="trip-card__value">{formatDuration(trip.movingTimeMs)}</span>
        </div>
      </div>
      {trip.elevationGainMeters !== null && (
        <div className="trip-card__elevation">
          <span>↑{trip.elevationGainMeters} m</span>
          {trip.elevationLossMeters !== null && <span>↓{trip.elevationLossMeters} m</span>}
        </div>
      )}
    </button>
  );
}
