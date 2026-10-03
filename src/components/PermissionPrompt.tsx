import type { GPSError, PermissionState, TrackingStatus } from '../types/gps';

interface PermissionPromptProps {
  permission: PermissionState;
  status: TrackingStatus;
  error: GPSError | null;
  isTracking: boolean;
  onEnable: () => void;
}

/** Explains why location is needed and surfaces GPS errors in plain language. */
export function PermissionPrompt({ permission, status, error, isTracking, onEnable }: PermissionPromptProps) {
  const fatal = status === 'unsupported' || error?.kind === 'insecure-context';
  const denied = permission === 'denied' || error?.kind === 'permission-denied';
  const needsPermission = !isTracking && permission !== 'granted' && !fatal;

  if (!error && !needsPermission) return null;

  const tone = error && error.kind !== 'timeout' ? 'error' : error ? 'warn' : 'info';

  return (
    <div className={`notice notice--${tone}`} role={error ? 'alert' : undefined} id="gps-notice">
      <svg className="notice__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
          fill="currentColor"
        />
      </svg>
      <div className="notice__body">
        <p className="notice__text">
          {error?.message ?? 'Location permission is required to measure your speed.'}
        </p>
        {needsPermission && !denied && (
          <button id="enable-gps" type="button" className="btn btn--small" onClick={onEnable}>
            ENABLE GPS
          </button>
        )}
        {denied && !isTracking && (
          <button id="retry-gps" type="button" className="btn btn--small btn--ghost" onClick={onEnable}>
            TRY AGAIN
          </button>
        )}
      </div>
    </div>
  );
}
