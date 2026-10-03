/**
 * Trip history page — lists all saved trips newest first.
 */
import { useCallback, useEffect, useState } from 'react';
import type { SpeedUnit } from '../types/gps';
import type { AppRoute, TripMeta } from '../types/trip';
import { listTrips } from '../storage/tripStore';
import { TripCard } from './TripCard';

interface TripHistoryPageProps {
  unit: SpeedUnit;
  onNavigate: (route: AppRoute) => void;
  /** Increment to force a refresh (e.g. after a trip is saved). */
  refreshKey: number;
}

function groupByDate(trips: TripMeta[]): Map<string, TripMeta[]> {
  const groups = new Map<string, TripMeta[]>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const fmt = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = fmt(today);
  const yesterdayKey = fmt(yesterday);

  for (const trip of trips) {
    const d = new Date(trip.startedAt);
    const key = fmt(d);
    let label: string;
    if (key === todayKey) label = 'Today';
    else if (key === yesterdayKey) label = 'Yesterday';
    else label = d.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });

    const group = groups.get(label) ?? [];
    group.push(trip);
    groups.set(label, group);
  }
  return groups;
}

export function TripHistoryPage({ unit, onNavigate, refreshKey }: TripHistoryPageProps) {
  const [trips, setTrips] = useState<TripMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listTrips()
      .then(setTrips)
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleClick = useCallback((id: string) => {
    onNavigate({ page: 'trip', id });
  }, [onNavigate]);

  const groups = groupByDate(trips);

  return (
    <div className="page page--trips">
      <header className="page__header">
        <h1 className="page__title">TRIP HISTORY</h1>
        <span className="page__count">{trips.length} trip{trips.length !== 1 ? 's' : ''}</span>
      </header>

      {loading && (
        <div className="page__loading">Loading trips…</div>
      )}

      {!loading && trips.length === 0 && (
        <div className="page__empty">
          <div className="page__empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="48" height="48">
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"
                fill="currentColor"
                opacity="0.3"
              />
            </svg>
          </div>
          <p>No trips recorded yet.</p>
          <p className="muted">Start tracking to record your first trip.</p>
        </div>
      )}

      {!loading && [...groups.entries()].map(([label, groupTrips]) => (
        <section key={label} className="trip-group">
          <h2 className="trip-group__label">{label}</h2>
          <div className="trip-group__list">
            {groupTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} unit={unit} onClick={() => handleClick(trip.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
