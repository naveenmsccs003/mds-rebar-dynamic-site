/**
 * Modal yes/no for destructive or consequential actions. Focus starts on
 * Cancel (the safe choice), is trapped inside, and returns to the
 * triggering button on close; Escape cancels (`useDialogFocus`).
 */
import { useRef } from "react";

import { Button } from "../Button/Button";
import { useDialogFocus } from "./useDialogFocus";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  busy,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialogFocus(panelRef, open, onCancel);

  if (!open) return null;
  return (
    <div className="confirm" role="alertdialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown}>
      <div className="confirm__backdrop" onClick={onCancel} />
      <div className="confirm__panel" ref={panelRef} tabIndex={-1}>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
        <div className="confirm__actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy} data-autofocus>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className={destructive ? "button--danger" : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
