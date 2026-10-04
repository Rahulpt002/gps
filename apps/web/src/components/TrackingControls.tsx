interface TrackingControlsProps {
  isTracking: boolean;
  hasData: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

export function TrackingControls({ isTracking, hasData, disabled, onStart, onStop, onReset }: TrackingControlsProps) {
  const handleReset = () => {
    if (!hasData || window.confirm('Reset the current session? All statistics will be cleared.')) onReset();
  };

  return (
    <div className="controls">
      {isTracking ? (
        <button id="stop-tracking" type="button" className="btn btn--stop" onClick={onStop}>
          <span className="btn__icon btn__icon--stop" aria-hidden="true" />
          STOP TRACKING
        </button>
      ) : (
        <button id="start-tracking" type="button" className="btn btn--start" onClick={onStart} disabled={disabled}>
          <span className="btn__icon btn__icon--start" aria-hidden="true" />
          {hasData ? 'RESUME TRACKING' : 'START TRACKING'}
        </button>
      )}
      <button id="reset-session" type="button" className="btn btn--ghost" onClick={handleReset} disabled={!hasData}>
        RESET SESSION
      </button>
    </div>
  );
}
