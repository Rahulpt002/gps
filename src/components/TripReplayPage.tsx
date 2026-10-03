import { useCallback, useEffect, useState } from 'react';
import type { SpeedUnit, TrackSelection } from '../types/gps';
import type { AppRoute, Trip } from '../types/trip';
import { getTrip } from '../storage/tripStore';
import { TrackingMap } from './TrackingMap';
import { SpeedChart } from './SpeedChart';
import { ElevationChart } from './ElevationChart';
import { useReplay } from '../hooks/useReplay';
import { ReplayControls } from './ReplayControls';
import { formatSpeedWithUnit, formatClockTime } from '../utils/format';

interface TripReplayPageProps {
  id: string;
  unit: SpeedUnit;
  onNavigate: (route: AppRoute) => void;
}

export function TripReplayPage({ id, unit, onNavigate }: TripReplayPageProps) {
  const [trip, setTrip] = useState<Trip | null>(null);

  useEffect(() => {
    getTrip(id).then(t => {
      if (t) setTrip(t);
      else onNavigate({ page: 'trips' });
    });
  }, [id, onNavigate]);

  const {
    playing,
    speed,
    currentIndex,
    progress,
    togglePlay,
    setSpeed,
    seekToIndex,
    restart,
  } = useReplay(trip?.points ?? []);

  // Map map/chart selection clicks to the replay cursor.
  const handleSelect = useCallback((index: number | null) => {
    if (index !== null) seekToIndex(index);
  }, [seekToIndex]);

  if (!trip) return <div className="page page--trip"><div className="page__loading">Loading replay…</div></div>;

  const currentPoint = trip.points[currentIndex] ?? null;
  const currentSpeedLabel = currentPoint 
    ? formatSpeedWithUnit(currentPoint.speed, unit, 0)
    : null;

  // Sync the replay cursor into the selection state expected by the charts.
  const selection: TrackSelection | null = currentPoint 
    ? { index: currentIndex, source: 'chart' }
    : null;

  return (
    <div className="page page--trip-replay">
      <header className="page__header">
        <button type="button" className="page__back" onClick={() => onNavigate({ page: 'trip', id })}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="page__header-titles">
          <h1 className="page__title">REPLAY</h1>
          <span className="page__subtitle">{currentPoint ? formatClockTime(currentPoint.timestamp) : ''}</span>
        </div>
      </header>

      <section className="map-panel" aria-label="Replay map and charts">
        <TrackingMap
          points={trip.points}
          currentPosition={currentPoint}
          currentSpeedLabel={currentSpeedLabel}
          isTracking={true} // True forces the map to follow the current marker
          unit={unit}
          selection={selection}
          onSelect={handleSelect}
        />
        <SpeedChart 
          points={trip.points} 
          unit={unit} 
          selection={selection} 
          onSelect={handleSelect} 
        />
        {trip.elevationGainMeters !== null && (
          <ElevationChart 
            points={trip.points} 
            selection={selection} 
            onSelect={handleSelect} 
          />
        )}
      </section>

      <ReplayControls
        playing={playing}
        speed={speed}
        progress={progress}
        onTogglePlay={togglePlay}
        onRestart={restart}
        onChangeSpeed={setSpeed}
      />
    </div>
  );
}
