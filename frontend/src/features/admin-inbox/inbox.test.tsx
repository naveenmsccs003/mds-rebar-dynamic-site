import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { API_BASE, ok, server } from "../../test/msw/server";
import { ApplicationsPage } from "./ApplicationsPage";
import { EnquiriesPage } from "./EnquiriesPage";
import { QuoteRequestsPage } from "./QuoteRequestsPage";
import {
  ENQUIRY_MODEL,
  QUOTE_MODEL,
  requiredPermForTransition,
} from "./leadLifecycle";
import type { ApplicationRow, EnquiryRow, QuoteRequestRow } from "./types";

vi.mock("../auth/usePermission", () => ({
  usePermission: () => true,
  usePermissionChecker: () => () => true,
}));

const QUOTES = `${API_BASE}/admin/quote-requests/`;
const ENQUIRIES = `${API_BASE}/admin/enquiries/`;
const APPS = `${API_BASE}/admin/career-applications/`;

const page = <T,>(results: T[]) => ok({ count: results.length, next: null, previous: null, results });

const quote = (o: Partial<QuoteRequestRow> = {}): QuoteRequestRow => ({
  id: 1,
  public_reference: "MDS-Q-2026-000001",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "",
  company: "ACME",
  country_code: "ae",
  service_slug: "rebar-detailing",
  required_service_slugs: [],
  project_type: "",
  project_location: "",
  project_size: "",
  timeline: "",
  message: "We need 40t of rebar detailed.",
  status: "new",
  allowed_transitions: ["assigned", "in_progress", "closed", "spam"],
  assigned_to: null,
  assigned_to_email: "",
  ip_address: "1.2.3.4",
  user_agent: "curl",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...o,
});

const enquiry = (o: Partial<EnquiryRow> = {}): EnquiryRow => ({
  id: 7,
  public_reference: "MDS-E-2026-000007",
  name: "Sam Client",
  email: "sam@example.com",
  phone: "",
  company: "",
  enquiry_type: "business",
  message: "Do you work in Qatar?",
  status: "new",
  allowed_transitions: ["assigned", "in_progress", "responded", "closed", "spam"],
  assigned_to: null,
  assigned_to_email: "",
  notes: [],
  ip_address: null,
  user_agent: "",
  created_at: "2026-09-01T00:00:00Z",
  ...o,
});

const application = (o: Partial<ApplicationRow> = {}): ApplicationRow => ({
  id: 3,
  uuid: "u-3",
  job: 2,
  job_title: "Rebar Detailer",
  job_slug: "rebar-detailer",
  name: "Pat Applicant",
  email: "pat@example.com",
  phone: "",
  cover_letter: "Keen to join.",
  additional_info: "",
  resume: 99,
  resume_filename: "pat-cv.pdf",
  resume_status: "clean",
  status: "new",
  assigned_to: null,
  assigned_to_email: "",
  ip_address: null,
  user_agent: "",
  created_at: "2026-09-01T00:00:00Z",
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

describe("leadLifecycle.requiredPermForTransition", () => {
  it("maps a move to the verb the backend gates it on", () => {
    expect(requiredPermForTransition(ENQUIRY_MODEL, "assigned")).toBe("contact.assign_enquiry");
    expect(requiredPermForTransition(ENQUIRY_MODEL, "responded")).toBe("contact.respond_enquiry");
    expect(requiredPermForTransition(ENQUIRY_MODEL, "closed")).toBe("contact.close_enquiry");
    expect(requiredPermForTransition(ENQUIRY_MODEL, "in_progress")).toBe("contact.change_enquiry");
    // QuoteRequest has no respond_ verb -> falls back to change_ like the server
    expect(requiredPermForTransition(QUOTE_MODEL, "responded")).toBe("quotations.change_quoterequest");
    expect(requiredPermForTransition(QUOTE_MODEL, "assigned")).toBe("quotations.assign_quoterequest");
  });
});

describe("QuoteRequestsPage", () => {
  it("lists requests and patches status + assignee in one request", async () => {
    let patched: Record<string, unknown> | undefined;
    server.use(
      http.get(QUOTES, () => HttpResponse.json(page([quote()]))),
      http.get(`${QUOTES}1/`, () => HttpResponse.json(ok(quote()))),
      http.patch(`${QUOTES}1/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ok(quote({ status: "assigned", assigned_to: 5 })));
      }),
    );

    render(<QuoteRequestsPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByText("MDS-Q-2026-000001"));

    const dialog = await screen.findByRole("dialog", { name: "MDS-Q-2026-000001" });
    expect(dialog).toHaveTextContent("We need 40t of rebar detailed.");

    const d = within(dialog);
    await userEvent.selectOptions(d.getByLabelText("Status"), "assigned");
    await userEvent.type(d.getByLabelText(/Assigned to \(user id\)/), "5");
    await userEvent.click(d.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patched).toBeDefined());
    expect(patched).toEqual({ status: "assigned", assigned_to: 5 });
  });
});

describe("EnquiriesPage", () => {
  it("appends an internal note", async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get(ENQUIRIES, () => HttpResponse.json(page([enquiry()]))),
      http.get(`${ENQUIRIES}7/`, () => HttpResponse.json(ok(enquiry()))),
      http.post(`${ENQUIRIES}7/notes/`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          ok({ id: 1, note: "Called back", author: 1, author_email: "me@mds.example", created_at: "x" }),
          { status: 201 },
        );
      }),
    );

    render(<EnquiriesPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByText("MDS-E-2026-000007"));
    await screen.findByRole("dialog", { name: "MDS-E-2026-000007" });

    await userEvent.type(screen.getByLabelText("Add a note"), "Called back");
    await userEvent.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => expect(posted).toEqual({ note: "Called back" }));
  });
});

describe("ApplicationsPage", () => {
  it("fetches a signed résumé link on demand", async () => {
    server.use(
      http.get(APPS, () => HttpResponse.json(page([application()]))),
      http.get(`${APPS}3/`, () => HttpResponse.json(ok(application()))),
      http.get(`${APPS}3/resume/`, () =>
        HttpResponse.json(ok({ url: "https://files.example/pat-cv.pdf?sig=abc", expires_in: 120 })),
      ),
    );

    render(<ApplicationsPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByText("Pat Applicant"));
    await screen.findByRole("dialog", { name: "Pat Applicant — Rebar Detailer" });

    await userEvent.click(screen.getByRole("button", { name: "Get résumé link" }));

    const link = await screen.findByRole("link", { name: /Download pat-cv\.pdf/ });
    expect(link).toHaveAttribute("href", "https://files.example/pat-cv.pdf?sig=abc");
  });
});
