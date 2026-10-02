/**
 * Slide-over panel for admin create/edit forms. Closes on Escape and on
 * a backdrop click; focus moves into the panel, stays trapped there, and
 * is restored on close (`useDialogFocus`, docs/UI_DESIGN_SYSTEM.md
 * accessibility).
 */
import { useRef, type ReactNode } from "react";

import { useDialogFocus } from "./useDialogFocus";

export interface FormDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Footer actions (Save / Cancel / Delete …). */
  footer?: ReactNode;
}

export function FormDrawer({ open, title, onClose, children, footer }: FormDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialogFocus(panelRef, open, onClose);

  if (!open) return null;

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown}>
      <div className="drawer__backdrop" onClick={onClose} />
      <div className="drawer__panel" ref={panelRef} tabIndex={-1}>
        <div className="drawer__head">
          <h2>{title}</h2>
          <button type="button" className="button button--secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__footer">{footer}</div>}
      </div>
    </div>
  );
}
