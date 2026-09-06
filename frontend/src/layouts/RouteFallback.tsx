import { Container } from "../components/Container/Container";
import { Skeleton } from "../components/Skeleton/Skeleton";

/** Shown while a lazily-loaded route chunk is fetched (see app/router). */
export function RouteFallback() {
  return (
    <Container>
      <div role="status" aria-live="polite" style={{ paddingBlock: "var(--space-6)" }}>
        <span className="sr-only">Loading…</span>
        <Skeleton lines={8} />
      </div>
    </Container>
  );
}
