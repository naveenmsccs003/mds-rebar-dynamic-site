/**
 * Displayed on any failed API-driven fetch. Never shows raw
 * error/stack-trace text from the backend (docs/SECURITY.md,
 * docs/API_DESIGN.md) — only the safe envelope message plus a retry
 * action, matching the accessible-error-messaging requirement in
 * docs/UI_DESIGN_SYSTEM.md.
 */
export function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state state--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="button button--secondary">
          Retry
        </button>
      )}
    </div>
  );
}
