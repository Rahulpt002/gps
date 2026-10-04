import type { PlaybackSpeed } from '../hooks/useReplay';

interface ReplayControlsProps {
  playing: boolean;
  speed: PlaybackSpeed;
  progress: number;
  onTogglePlay: () => void;
  onRestart: () => void;
  onChangeSpeed: (speed: PlaybackSpeed) => void;
}

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 5, 10];

export function ReplayControls({
  playing,
  speed,
  progress,
  onTogglePlay,
  onRestart,
  onChangeSpeed,
}: ReplayControlsProps) {
  return (
    <div className="replay-controls">
      <div className="replay-controls__progress">
        <div 
          className="replay-controls__progress-bar"
          style={{ transform: `scaleX(${progress})` }} 
        />
      </div>
      
      <div className="replay-controls__row">
        <div className="replay-controls__actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={onRestart} aria-label="Restart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          
          <button type="button" className="btn btn--small" onClick={onTogglePlay}>
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            {playing ? 'PAUSE' : 'PLAY'}
          </button>
        </div>
        
        <div className="replay-controls__speeds">
          {SPEEDS.map(s => (
            <button
              key={s}
              type="button"
              className={`replay-controls__speed ${speed === s ? 'replay-controls__speed--active' : ''}`}
              onClick={() => onChangeSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
