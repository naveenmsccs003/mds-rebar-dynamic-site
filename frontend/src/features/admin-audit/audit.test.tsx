import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { API_BASE, ok, server } from "../../test/msw/server";
import { AuditLogPage } from "./AuditLogPage";
import { cursorFrom } from "./hooks";
import type { AuditRow } from "./types";

const AUDIT = `${API_BASE}/admin/audit/`;

const entry = (o: Partial<AuditRow> = {}): AuditRow => ({
  id: 10,
  action: "user.updated",
  entity_type: "users.User",
  entity_id: "5",
  actor: 1,
  actor_email: "admin@mds.example",
  before: { is_active: true, roles: ["HR"] },
  after: { is_active: false, roles: ["HR"] },
  ip_address: "10.0.0.1",
  user_agent: "Firefox",
  timestamp: "2026-09-02T10:00:00Z",
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

describe("cursorFrom", () => {
  it("pulls the cursor out of a next/previous link", () => {
    expect(cursorFrom("http://api.example/api/v1/admin/audit/?cursor=cD0y&action=x")).toBe("cD0y");
    expect(cursorFrom(null)).toBeNull();
    expect(cursorFrom("/api/v1/admin/audit/")).toBeNull();
  });
});

describe("AuditLogPage", () => {
  it("shows entries, a before/after diff, and no write controls", async () => {
    server.use(
      http.get(AUDIT, () => HttpResponse.json(ok({ next: null, previous: null, results: [entry()] }))),
    );

    render(<AuditLogPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByText("user.updated"));
    const dialog = await screen.findByRole("dialog", { name: "user.updated — users.User #5" });
    const d = within(dialog);

    expect(d.getByText("admin@mds.example")).toBeInTheDocument();
    const changed = d.getByText("is_active").closest("tr");
    expect(changed).toHaveClass("audit-diff__row--changed");
    expect(changed).toHaveTextContent("is_active (changed)truefalse");
    expect(d.getByText("roles").closest("tr")).not.toHaveClass("audit-diff__row--changed");
    expect(d.queryByRole("button", { name: /save|delete|edit/i })).toBeNull();
  });

  it("pages older by cursor and sends filters to the API", async () => {
    const seen: string[] = [];
    server.use(
      http.get(AUDIT, ({ request }) => {
        const url = new URL(request.url);
        seen.push(url.search);
        const cursor = url.searchParams.get("cursor");
        return HttpResponse.json(
          ok(
            cursor
              ? { next: null, previous: `${AUDIT}?cursor=bmV3ZXI`, results: [entry({ id: 9, action: "auth.logout" })] }
              : { next: `${AUDIT}?cursor=b2xkZXI`, previous: null, results: [entry()] },
          ),
        );
      }),
    );

    render(<AuditLogPage />, { wrapper: wrap() });
    await screen.findByText("user.updated");
    expect(screen.getByRole("button", { name: "← Newer" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Older →" }));
    await screen.findByText("auth.logout");
    expect(seen.at(-1)).toContain("cursor=b2xkZXI");

    await userEvent.type(screen.getByLabelText("Action"), "a");
    await waitFor(() => expect(seen.at(-1)).toBe("?action=a"));
  });
});
