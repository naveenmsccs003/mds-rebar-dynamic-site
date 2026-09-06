import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client (spec §57 — server state managed by
 * TanStack Query everywhere, not ad-hoc useEffect/fetch). Conservative
 * defaults: public content changes infrequently enough that a short
 * staleTime avoids refetch storms, while retry is capped so a broken
 * endpoint fails fast into the ErrorState UI instead of hanging.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
