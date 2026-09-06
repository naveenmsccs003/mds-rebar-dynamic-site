/**
 * `useServices` / `useService` against MSW — exercises the TanStack
 * Query hook + the real `api.ts` + `request.ts` unwrap together
 * (docs/TESTING.md "API integration tests ... for the TanStack Query
 * hooks").
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { API_BASE, ok, server } from "../../test/msw/server";
import { useService, useServices } from "./hooks";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const listItem = { id: 1, name: "Rebar Detailing", slug: "rebar-detailing", short_description: "", hero_image: null, icon: null, display_order: 0 };

describe("useServices", () => {
  it("returns the unwrapped, de-paginated list", async () => {
    server.use(
      http.get(`${API_BASE}/services/`, () =>
        HttpResponse.json(ok({ count: 1, next: null, previous: null, results: [listItem] })),
      ),
    );
    const { result } = renderHook(() => useServices(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([listItem]);
  });

  it("surfaces an error state on a 500", async () => {
    server.use(http.get(`${API_BASE}/services/`, () => new HttpResponse(null, { status: 500 })));
    const { result } = renderHook(() => useServices(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useService", () => {
  it("fetches one service by slug", async () => {
    server.use(
      http.get(`${API_BASE}/services/rebar-detailing/`, () =>
        HttpResponse.json(ok({ ...listItem, long_description: "<p>hi</p>" })),
      ),
    );
    const { result } = renderHook(() => useService("rebar-detailing"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.slug).toBe("rebar-detailing");
  });
});
