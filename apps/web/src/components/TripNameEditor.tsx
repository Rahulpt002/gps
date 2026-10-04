/**
 * Inline trip name editor.
 */
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

interface TripNameEditorProps {
  name: string;
  onSave: (name: string) => void;
}

export function TripNameEditor({ name, onSave }: TripNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setDraft(name);
    setEditing(true);
    // Focus after React renders the input.
    requestAnimationFrame(() => inputRef.current?.select());
  }, [name]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onSave(trimmed);
    setEditing(false);
  }, [draft, name, onSave]);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="trip-name__input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        maxLength={120}
        autoFocus
        aria-label="Trip name"
      />
    );
  }

  return (
    <button type="button" className="trip-name__display" onClick={startEditing} title="Click to rename">
      {name}
      <svg className="trip-name__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.42l-2.34-2.33a1 1 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z" fill="currentColor" />
      </svg>
    </button>
  );
}
