import { useCallback, useEffect, useState } from 'react';
import type { SpeedUnit, TrackSelection } from '@gps/core';
import type { AppRoute, Trip } from '@gps/core';
import { getTrip, updateTripName, deleteTrip } from '../storage/tripStore';
import { downloadGPX } from '../utils/gpx';
import { downloadTripJSON } from '../utils/tripExport';
import { TripNameEditor } from './TripNameEditor';
import { TripSummary } from './TripSummary';
import { TrackingMap } from './TrackingMap';
import { SpeedChart } from './SpeedChart';
import { ElevationChart } from './ElevationChart';
import { ConfirmDialog } from './ConfirmDialog';
import { Toast } from './Toast';

interface TripDetailsPageProps {
  id: string;
  unit: SpeedUnit;
  onNavigate: (route: AppRoute) => void;
  onDeleted: () => void; // Trigger a history refresh
}

export function TripDetailsPage({ id, unit, onNavigate, onDeleted }: TripDetailsPageProps) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selection, setSelection] = useState<TrackSelection | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getTrip(id).then(t => {
      if (t) setTrip(t);
      else onNavigate({ page: 'trips' });
    });
  }, [id, onNavigate]);

  const handleNameSave = useCallback(async (newName: string) => {
    if (!trip) return;
    await updateTripName(trip.id, newName);
    setTrip({ ...trip, name: newName });
    setToast('Name updated');
  }, [trip]);

  const handleDelete = useCallback(async () => {
    await deleteTrip(id);
    onDeleted(); // Notify app to refresh history
    onNavigate({ page: 'trips' });
  }, [id, onDeleted, onNavigate]);

  const handleSelect = useCallback((idx: number | null, source: TrackSelection['source']) => {
    setSelection(prev => {
      if (idx !== null) return { index: idx, source };
      return prev && prev.source !== source ? prev : null;
    });
  }, []);

  if (!trip) return <div className="page page--trip"><div className="page__loading">Loading trip…</div></div>;

  return (
    <div className="page page--trip">
      <header className="page__header">
        <button type="button" className="page__back" onClick={() => onNavigate({ page: 'trips' })}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <TripNameEditor name={trip.name} onSave={handleNameSave} />
      </header>

      <TripSummary
        distanceMeters={trip.distanceMeters}
        movingTimeMs={trip.movingTimeMs}
        totalTimeMs={trip.durationMs}
        averageSpeedMps={trip.averageSpeedMps}
        maxSpeedMps={trip.maxSpeedMps}
        pointCount={trip.pointCount}
        unit={unit}
      />
      
      {trip.elevationGainMeters !== null && (
        <section className="summary" aria-label="Elevation summary" style={{ marginTop: 10 }}>
          <dl className="summary__grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="summary__item">
              <dt>Elevation Gain</dt>
              <dd>
                <span className="summary__value">↑{trip.elevationGainMeters}</span>
                <span className="summary__unit">m</span>
              </dd>
            </div>
            <div className="summary__item">
              <dt>Elevation Loss</dt>
              <dd>
                <span className="summary__value">↓{trip.elevationLossMeters}</span>
                <span className="summary__unit">m</span>
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="map-panel" aria-label="Route map and charts">
        <TrackingMap
          points={trip.points}
          currentPosition={null}
          currentSpeedLabel={null}
          isTracking={false}
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

      <div className="trip-actions">
        <button type="button" className="btn btn--start" onClick={() => onNavigate({ page: 'replay', id })}>
          ▶ REPLAY TRIP
        </button>
        
        <div className="trip-actions__row">
          <button type="button" className="btn btn--ghost" onClick={() => downloadGPX(trip)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            EXPORT GPX
          </button>
          
          <button type="button" className="btn btn--ghost" onClick={() => downloadTripJSON(trip)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            EXPORT JSON
          </button>
        </div>
        
        <button type="button" className="btn btn--danger btn--ghost" onClick={() => setShowDelete(true)}>
          DELETE TRIP
        </button>
      </div>

      {showDelete && (
        <ConfirmDialog
          title="Delete this trip?"
          message="This cannot be undone."
          confirmLabel="DELETE"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
      
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
