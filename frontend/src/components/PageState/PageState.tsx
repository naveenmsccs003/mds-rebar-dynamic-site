import type { ReactNode } from "react";

import { ErrorState } from "../ErrorState/ErrorState";
import { LoadingState } from "../LoadingState/LoadingState";

/**
 * Collapses a TanStack Query result into the four required data states
 * (spec §50/§65 — Loading / Success / Empty / Error+Retry, never a blank
 * broken screen). Feature pages wrap their content in this instead of
 * re-implementing the `isPending` / `isError` / empty checks each time.
 */
export interface PageStateProps<T> {
  query: {
    isPending: boolean;
    isError: boolean;
    data: T | undefined;
    error: unknown;
    refetch: () => unknown;
  };
  /** Treat this data as "empty" (renders `emptyState` instead of children). */
  isEmpty?: (data: T) => boolean;
  loadingState?: ReactNode;
  emptyState?: ReactNode;
  children: (data: T) => ReactNode;
}

function messageOf(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return error.message;
  return undefined;
}

export function PageState<T>({
  query,
  isEmpty,
  loadingState,
  emptyState,
  children,
}: PageStateProps<T>) {
  if (query.isPending) return <>{loadingState ?? <LoadingState />}</>;
  if (query.isError || query.data === undefined) {
    return <ErrorState message={messageOf(query.error)} onRetry={() => query.refetch()} />;
  }
  if (isEmpty?.(query.data)) return <>{emptyState ?? null}</>;
  return <>{children(query.data)}</>;
}
