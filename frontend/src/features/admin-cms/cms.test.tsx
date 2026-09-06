import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { API_BASE, ok, server } from "../../test/msw/server";
import { SectionsPage } from "./SectionsPage";
import {
  useSectionCreate,
  useSectionTransition,
  useSectionVersions,
  useSections,
} from "./hooks";
import type { PageSectionRow } from "./types";

vi.mock("../auth/usePermission", () => ({
  usePermission: () => true,
  usePermissionChecker: () => () => true,
}));

const SECTIONS = `${API_BASE}/admin/cms/sections/`;

const row = (o: Partial<PageSectionRow> = {}): PageSectionRow => ({
  id: 1,
  page_key: "home",
  section_key: "hero",
  display_order: 0,
  content: { heading: "Hi" },
  status: "draft",
  allowed_transitions: ["review", "archived"],
  published_at: null,
  scheduled_publish_at: null,
  current_version: null,
  updated_by_email: "ed@mds.example",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...o,
});

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CMS section hooks", () => {
  it("lists sections", async () => {
    server.use(
      http.get(SECTIONS, () => HttpResponse.json(ok({ count: 1, next: null, previous: null, results: [row()] }))),
    );
    const { result } = renderHook(() => useSections({}), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.results[0].section_key).toBe("hero");
  });

  it("creates a section", async () => {
    let posted: unknown;
    server.use(
      http.post(SECTIONS, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(ok(row({ id: 9 })), { status: 201 });
      }),
    );
    const { result } = renderHook(() => useSectionCreate(), { wrapper: wrap() });
    await result.current.mutateAsync({
      page_key: "about",
      section_key: "intro",
      display_order: 1,
      content: {},
    });
    expect(posted).toMatchObject({ page_key: "about", section_key: "intro" });
  });

  it("transitions a section", async () => {
    let body: unknown;
    server.use(
      http.post(`${SECTIONS}1/transition/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(ok(row({ status: "review" })));
      }),
    );
    const { result } = renderHook(() => useSectionTransition(), { wrapper: wrap() });
    await result.current.mutateAsync({ id: 1, to: "review", note: "go" });
    expect(body).toEqual({ to: "review", note: "go" });
  });

  it("loads version history", async () => {
    server.use(
      http.get(`${SECTIONS}1/versions/`, () =>
        HttpResponse.json(
          ok({
            count: 1,
            next: null,
            previous: null,
            results: [
              { id: 2, snapshot: {}, note: "edited", edited_by_email: "ed@x", edited_at: "2026-09-01T00:00:00Z" },
            ],
          }),
        ),
      ),
    );
    const { result } = renderHook(() => useSectionVersions(1), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.results[0].note).toBe("edited");
  });
});

describe("SectionsPage", () => {
  it("renders the table and opens the create drawer", async () => {
    server.use(
      http.get(SECTIONS, () =>
        HttpResponse.json(ok({ count: 1, next: null, previous: null, results: [row()] })),
      ),
    );
    render(<SectionsPage />, { wrapper: wrap() });

    expect(await screen.findByText("hero")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "New section" }));
    expect(await screen.findByRole("dialog", { name: /new section/i })).toBeInTheDocument();
  });
});
