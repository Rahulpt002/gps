import type { TrackingStatus } from '../types/gps';

const LABELS: Record<TrackingStatus, string> = {
  ready: 'GPS READY',
  acquiring: 'ACQUIRING GPS',
  tracking: 'TRACKING',
  weak: 'GPS SIGNAL WEAK',
  error: 'GPS ERROR',
  unsupported: 'GPS UNAVAILABLE',
};

export function GPSStatus({ status }: { status: TrackingStatus }) {
  return (
    <div className={`status status--${status}`} id="gps-status" role="status" aria-live="polite">
      <span className="status__dot" aria-hidden="true" />
      <span className="status__label">{LABELS[status]}</span>
    </div>
  );
}
