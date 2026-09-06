import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { API_BASE, ok } from "../../test/msw/server";
import { server } from "../../test/msw/server";
import { CareersPage } from "./CareersPage";
import { ServicesPage } from "./ServicesPage";
import { services } from "./hooks";

vi.mock("../auth/usePermission", () => ({
  usePermission: () => true,
  usePermissionChecker: () => () => true,
}));

const SVC = `${API_BASE}/admin/services/`;
const JOBS = `${API_BASE}/admin/careers/`;

const svcRow = {
  id: 1,
  name: "Rebar Detailing",
  slug: "rebar-detailing",
  short_description: "s",
  long_description: "",
  business_value: "",
  standards_codes: "",
  deliverables: "",
  output_formats: "",
  display_order: 0,
  hero_image: null,
  icon: null,
  og_image: null,
  technology: ["autocad"],
  status: "draft",
  allowed_transitions: ["review"],
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("catalogue service hooks", () => {
  it("transitions a service with a note", async () => {
    let body: unknown;
    server.use(
      http.post(`${SVC}1/transition/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(ok({ ...svcRow, status: "review" }));
      }),
    );
    const { result } = renderHook(() => services.useTransition(), { wrapper: wrap() });
    await result.current.mutateAsync({ id: 1, to: "review", note: "ready" });
    expect(body).toEqual({ to: "review", note: "ready" });
  });
});

describe("ServicesPage", () => {
  it("lists services and creates one, sending technology as a slug array", async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get(SVC, () => HttpResponse.json(ok({ count: 1, next: null, previous: null, results: [svcRow] }))),
      http.post(SVC, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ok({ ...svcRow, id: 2 }), { status: 201 });
      }),
    );
    render(<ServicesPage />, { wrapper: wrap() });

    expect(await screen.findByText("Rebar Detailing")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "New" }));

    await screen.findByRole("dialog", { name: "New" });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Estimation" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "estimation" } });
    fireEvent.change(screen.getByLabelText(/Technology \(comma-separated slugs\)/), {
      target: { value: "asa, tekla" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(posted).toBeDefined());
    expect(posted!.name).toBe("Estimation");
    expect(posted!.technology).toEqual(["asa", "tekla"]);
  });
});

describe("CareersPage", () => {
  it("creates a job posting", async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get(JOBS, () => HttpResponse.json(ok({ count: 0, next: null, previous: null, results: [] }))),
      http.post(JOBS, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ok({ id: 5 }), { status: 201 });
      }),
    );
    render(<CareersPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByRole("button", { name: "New posting" }));
    await userEvent.type(screen.getByLabelText("Title"), "Detailer");
    await userEvent.type(screen.getByLabelText("Slug"), "detailer");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(posted?.title).toBe("Detailer"));
    expect(posted?.application_deadline).toBeNull();
  });
});
