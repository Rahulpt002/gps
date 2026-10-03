interface MapControlsProps {
  showRecenter: boolean;
  showFitRoute: boolean;
  onRecenter: () => void;
  onFitRoute: () => void;
}

export function MapControls({ showRecenter, showFitRoute, onRecenter, onFitRoute }: MapControlsProps) {
  if (!showRecenter && !showFitRoute) return null;
  return (
    <div className="map-controls">
      {showRecenter && (
        <button id="map-recenter" type="button" className="map-btn" onClick={onRecenter}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.94 3A8.99 8.99 0 0 0 13 3.06V1h-2v2.06A8.99 8.99 0 0 0 3.06 11H1v2h2.06A8.99 8.99 0 0 0 11 20.94V23h2v-2.06A8.99 8.99 0 0 0 20.94 13H23v-2h-2.06ZM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"
              fill="currentColor"
            />
          </svg>
          RECENTER
        </button>
      )}
      {showFitRoute && (
        <button id="map-fit-route" type="button" className="map-btn" onClick={onFitRoute}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V4h5v2H6v3H4Zm11-5h5v5h-2V6h-3V4ZM6 15v3h3v2H4v-5h2Zm12 0h2v5h-5v-2h3v-3Z" fill="currentColor" />
          </svg>
          FIT ROUTE
        </button>
      )}
    </div>
  );
}
