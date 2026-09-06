/**
 * Temporary stand-in for routes not yet built (Phases 5-11 wire these up
 * to real feature modules under src/features/). Exists so the router's
 * full route table — matching the public navigation in the spec — is
 * real and testable from Phase 1 onward, without pre-building page
 * content ahead of its phase.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p>[CONTENT PLACEHOLDER — ADMIN TO COMPLETE]</p>
    </div>
  );
}
