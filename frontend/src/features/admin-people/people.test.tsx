import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { API_BASE, ok, server } from "../../test/msw/server";
import { RolesPage } from "./RolesPage";
import { UsersPage } from "./UsersPage";
import type { RoleRow, UserRow } from "./types";

vi.mock("../auth/usePermission", () => ({
  usePermission: () => true,
  usePermissionChecker: () => () => true,
}));
vi.mock("../auth/hooks", () => ({
  useSession: () => ({ data: { id: 1, email: "admin@mds.example" } }),
}));

const USERS = `${API_BASE}/admin/users/`;
const ROLES = `${API_BASE}/admin/roles/`;

const page = <T,>(results: T[]) => ok({ count: results.length, next: null, previous: null, results });

const role = (o: Partial<RoleRow> = {}): RoleRow => ({
  id: 1,
  name: "ContentManager",
  permissions: ["news.view_news", "services.change_service", "services.view_service"],
  user_count: 2,
  ...o,
});

const user = (o: Partial<UserRow> = {}): UserRow => ({
  id: 5,
  email: "sam@mds.example",
  first_name: "Sam",
  last_name: "Staff",
  full_name: "Sam Staff",
  is_active: true,
  is_staff: true,
  roles: ["ContentManager"],
  is_locked: false,
  last_login: null,
  last_login_ip: null,
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

const roles = [role(), role({ id: 2, name: "HR", permissions: [], user_count: 0 })];

describe("UsersPage", () => {
  it("creates a user without a password and says a set-password email was sent", async () => {
    let posted: Record<string, unknown> | undefined;
    server.use(
      http.get(USERS, () => HttpResponse.json(page([]))),
      http.get(ROLES, () => HttpResponse.json(page(roles))),
      http.post(USERS, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ok(user({ email: "new@mds.example", roles: ["HR"] })), { status: 201 });
      }),
    );

    render(<UsersPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByRole("button", { name: "New user" }));
    const d = within(await screen.findByRole("dialog", { name: "New user" }));

    await userEvent.type(d.getByLabelText("Email"), "new@mds.example");
    await userEvent.type(d.getByLabelText("First name"), "New");
    await userEvent.click(await d.findByLabelText("HR"));
    await userEvent.click(d.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(posted).toBeDefined());
    expect(posted).toEqual({
      email: "new@mds.example",
      first_name: "New",
      last_name: "",
      is_active: true,
      is_staff: true,
      roles: ["HR"],
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/set-password email/);
  });

  it("deactivates a user after confirming", async () => {
    let patched: Record<string, unknown> | undefined;
    server.use(
      http.get(USERS, () => HttpResponse.json(page([user()]))),
      http.get(ROLES, () => HttpResponse.json(page(roles))),
      http.patch(`${USERS}5/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ok(user({ is_active: false })));
      }),
    );

    render(<UsersPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByText("sam@mds.example"));
    const d = within(await screen.findByRole("dialog", { name: "sam@mds.example" }));
    await userEvent.click(d.getByRole("button", { name: "Deactivate user" }));

    const confirm = await screen.findByRole("alertdialog", { name: "Deactivate this user?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(patched).toEqual({ is_active: false }));
  });

  it("won't let you deactivate your own account", async () => {
    server.use(
      http.get(USERS, () => HttpResponse.json(page([user({ id: 1, email: "admin@mds.example" })]))),
      http.get(ROLES, () => HttpResponse.json(page(roles))),
    );

    render(<UsersPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByText("admin@mds.example"));
    const d = within(await screen.findByRole("dialog", { name: "admin@mds.example" }));
    expect(d.getByRole("button", { name: "Deactivate user" })).toBeDisabled();
    expect(d.getByText("You can’t deactivate your own account.")).toBeInTheDocument();
  });

  it("sends only profile + role fields when saving an edit", async () => {
    let patched: Record<string, unknown> | undefined;
    server.use(
      http.get(USERS, () => HttpResponse.json(page([user()]))),
      http.get(ROLES, () => HttpResponse.json(page(roles))),
      http.patch(`${USERS}5/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ok(user({ roles: ["ContentManager", "HR"] })));
      }),
    );

    render(<UsersPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByText("sam@mds.example"));
    const d = within(await screen.findByRole("dialog", { name: "sam@mds.example" }));
    await userEvent.click(await d.findByLabelText("HR"));
    await userEvent.click(d.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(patched).toEqual({
        first_name: "Sam",
        last_name: "Staff",
        is_staff: true,
        roles: ["ContentManager", "HR"],
      }),
    );
  });
});

describe("RolesPage", () => {
  it("lists roles and shows a role's permissions grouped by app", async () => {
    server.use(http.get(ROLES, () => HttpResponse.json(page(roles))));

    render(<RolesPage />, { wrapper: wrap() });
    await userEvent.click(await screen.findByText("ContentManager"));
    const d = within(await screen.findByRole("dialog", { name: "ContentManager" }));

    expect(d.getByRole("region", { name: "services" })).toHaveTextContent("change_service");
    expect(d.getByRole("region", { name: "news" })).toHaveTextContent("view_news");
    expect(d.queryByRole("button", { name: /save|edit|delete/i })).toBeNull();
  });
});
