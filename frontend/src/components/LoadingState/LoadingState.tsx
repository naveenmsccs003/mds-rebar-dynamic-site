/**
 * Reused everywhere an API-driven view is fetching (spec §50/§65 — every
 * API-driven page must support Loading/Success/Empty/Error/Retry; never a
 * blank broken screen).
 */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="state state--loading">
      <span className="state__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
