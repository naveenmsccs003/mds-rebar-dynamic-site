import { type ComponentType, type ReactElement, lazy, Suspense } from "react";

import { RouteFallback } from "../layouts/RouteFallback";

/**
 * Wraps a dynamic `import()` as a route `element` so Vite code-splits it
 * (docs/PERFORMANCE.md). `pick` selects the (named) page export from the
 * loaded module.
 */
export function lazyRoute<M>(
  loader: () => Promise<M>,
  pick: (m: M) => ComponentType,
): ReactElement {
  const Lazy = lazy(() => loader().then((m) => ({ default: pick(m) })));
  return (
    <Suspense fallback={<RouteFallback />}>
      <Lazy />
    </Suspense>
  );
}
