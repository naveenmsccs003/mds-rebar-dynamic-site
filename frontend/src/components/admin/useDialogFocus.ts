/**
 * Keyboard + focus behaviour shared by the admin modal surfaces
 * (FormDrawer, ConfirmDialog — docs/UI_DESIGN_SYSTEM.md accessibility):
 *
 * - on open, focus moves into the dialog (an element marked
 *   `data-autofocus`, else the container) and is restored on close;
 * - Tab / Shift+Tab cycle inside the dialog instead of leaking to the
 *   page behind it;
 * - Escape closes it.
 *
 * Keys are handled on the dialog element itself, not `document`, and
 * stop propagating once handled — so a dialog nested in another (the
 * media picker inside an edit drawer, a confirm inside a drawer) closes
 * only itself. `onClose` is read through a ref so a parent passing a new
 * arrow each render doesn't re-run the open effect and steal focus from
 * whatever field the user is typing in.
 */
import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const root = ref.current;
    (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root)?.focus();
    return () => {
      if (restore && document.contains(restore)) restore.focus();
    };
  }, [open, ref]);

  return function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    e.stopPropagation();
    // `:disabled` also catches controls inside a disabled <fieldset>.
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.matches(":disabled") && !el.closest("[hidden], [inert]"),
    );
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
}
