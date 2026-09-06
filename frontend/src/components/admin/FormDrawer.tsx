/**
 * Slide-over panel for admin create/edit forms. Closes on Escape and on
 * a backdrop click; moves focus into the panel on open and restores it
 * on close (docs/UI_DESIGN_SYSTEM.md accessibility).
 */
import { useEffect, useRef, type ReactNode } from "react";

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
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>
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
