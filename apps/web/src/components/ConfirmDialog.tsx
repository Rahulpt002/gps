/**
 * Reusable confirmation dialog (modal).
 */
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="dialog-backdrop" onClick={onCancel} role="presentation">
      <div
        className="dialog"
        role="alertdialog"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-msg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="dialog__title" id="dialog-title">{title}</h2>
        <p className="dialog__message" id="dialog-msg">{message}</p>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn btn--small ${variant === 'danger' ? 'btn--danger' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
