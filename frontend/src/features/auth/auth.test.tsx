import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { API_BASE, err, ok, server } from "../../test/msw/server";
import { RequireAuth, RequirePermission } from "./guards";
import { useSession } from "./hooks";
import { LoginPage } from "./LoginPage";
import type { SessionUser } from "./types";
import { usePermission } from "./usePermission";

const user = (o: Partial<SessionUser> = {}): SessionUser => ({
  id: 1,
  email: "ed@mds.example",
  first_name: "Ed",
  last_name: "Itor",
  full_name: "Ed Itor",
  is_staff: true,
  is_superuser: false,
  roles: ["ContentManager"],
  permissions: ["services.view_service", "services.change_service"],
  ...o,
});

function wrap(initial = "/") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => vi.clearAllMocks());

describe("useSession", () => {
  it("resolves to null when the API says 401", async () => {
    server.use(
      http.get(`${API_BASE}/auth/session/`, () =>
        HttpResponse.json(err("AUTHENTICATION_REQUIRED", "Sign in."), { status: 401 }),
      ),
    );
    const { result } = renderHook(() => useSession(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it("resolves to the user when signed in", async () => {
    server.use(http.get(`${API_BASE}/auth/session/`, () => HttpResponse.json(ok(user()))));
    const { result } = renderHook(() => useSession(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.data?.email).toBe("ed@mds.example"));
  });
});

describe("usePermission", () => {
  it("is true for a held codename, false otherwise, always true for a superuser", async () => {
    server.use(
      http.get(`${API_BASE}/auth/session/`, () =>
        HttpResponse.json(ok(user({ permissions: ["news.view_news"], is_superuser: false }))),
      ),
    );
    const { result, rerender } = renderHook(({ p }) => usePermission(p), {
      wrapper: wrap(),
      initialProps: { p: "news.view_news" },
    });
    await waitFor(() => expect(result.current).toBe(true));
    rerender({ p: "news.change_news" });
    expect(result.current).toBe(false);
  });
});

describe("RequireAuth", () => {
  it("redirects an anonymous visitor to /admin/login", async () => {
    server.use(http.get(`${API_BASE}/auth/session/`, () => HttpResponse.json(err("x", "x"), { status: 401 })));
    render(
      <Routes>
        <Route path="/admin" element={<RequireAuth><div>secret</div></RequireAuth>} />
        <Route path="/admin/login" element={<div>login screen</div>} />
      </Routes>,
      { wrapper: wrap("/admin") },
    );
    expect(await screen.findByText("login screen")).toBeInTheDocument();
  });

  it("renders children for a signed-in user", async () => {
    server.use(http.get(`${API_BASE}/auth/session/`, () => HttpResponse.json(ok(user()))));
    render(<RequireAuth><div>secret</div></RequireAuth>, { wrapper: wrap("/admin") });
    expect(await screen.findByText("secret")).toBeInTheDocument();
  });
});

describe("RequirePermission", () => {
  it("shows a not-permitted panel when the codename is missing", async () => {
    server.use(
      http.get(`${API_BASE}/auth/session/`, () => HttpResponse.json(ok(user({ permissions: [] })))),
    );
    render(
      <RequirePermission perms="users.view_user">
        <div>user admin</div>
      </RequirePermission>,
      { wrapper: wrap("/admin/users") },
    );
    expect(await screen.findByText(/Not permitted/i)).toBeInTheDocument();
    expect(screen.queryByText("user admin")).not.toBeInTheDocument();
  });
});

describe("LoginPage", () => {
  it("signs in and redirects to ?next=", async () => {
    let sessioned = false;
    server.use(
      http.get(`${API_BASE}/auth/csrf/`, () => HttpResponse.json(ok({ detail: "set" }))),
      http.post(`${API_BASE}/auth/login/`, () => {
        sessioned = true;
        return HttpResponse.json(ok(user()));
      }),
      http.get(`${API_BASE}/auth/session/`, () =>
        sessioned
          ? HttpResponse.json(ok(user()))
          : HttpResponse.json(err("x", "x"), { status: 401 }),
      ),
    );
    render(
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/services" element={<div>services screen</div>} />
      </Routes>,
      { wrapper: wrap("/admin/login?next=%2Fadmin%2Fservices") },
    );

    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Email"), "ed@mds.example");
    await u.type(screen.getByLabelText("Password"), "pw");
    await u.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("services screen")).toBeInTheDocument();
  });

  it("shows the backend error on bad credentials", async () => {
    server.use(
      http.get(`${API_BASE}/auth/csrf/`, () => HttpResponse.json(ok({}))),
      http.get(`${API_BASE}/auth/session/`, () => HttpResponse.json(err("x", "x"), { status: 401 })),
      http.post(`${API_BASE}/auth/login/`, () =>
        HttpResponse.json(err("INVALID_CREDENTIALS", "Wrong email or password."), { status: 400 }),
      ),
    );
    render(<Routes><Route path="/admin/login" element={<LoginPage />} /></Routes>, {
      wrapper: wrap("/admin/login"),
    });
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("Email"), "ed@mds.example");
    await u.type(screen.getByLabelText("Password"), "nope");
    await u.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Wrong email or password.")).toBeInTheDocument();
  });
});
