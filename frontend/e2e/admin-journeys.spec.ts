import { expect, test } from "@playwright/test";

import { err, ok, stubApi } from "./support";

const EDITOR = {
  id: 1,
  email: "ed@mds.example",
  first_name: "Ed",
  last_name: "Itor",
  full_name: "Ed Itor",
  is_staff: true,
  is_superuser: false,
  roles: ["ContentManager"],
  permissions: ["pages.view_pagesection", "services.view_service", "news.view_news"],
};

const emptyPage = { count: 0, next: null, previous: null, results: [] };

test("anonymous visit to /admin bounces to the login screen", async ({ page }) => {
  await stubApi(page, {
    "GET /api/v1/auth/session": (route) => route.fulfill({ status: 401, json: err("x", "sign in") }),
  });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: /staff/i })).toBeVisible();
});

test("sign in → dashboard, sidebar reflects permissions, sign out", async ({ page }) => {
  let signedIn = false;
  await stubApi(page, {
    "GET /api/v1/auth/csrf": ok({ detail: "set" }),
    "GET /api/v1/auth/session": (route) =>
      signedIn
        ? route.fulfill({ json: ok(EDITOR) })
        : route.fulfill({ status: 401, json: err("x", "x") }),
    "POST /api/v1/auth/login": (route) => {
      signedIn = true;
      return route.fulfill({ json: ok(EDITOR) });
    },
    "POST /api/v1/auth/logout": (route) => {
      signedIn = false;
      return route.fulfill({ json: ok(null) });
    },
    "GET /api/v1/admin/cms/sections": ok(emptyPage),
    "GET /api/v1/admin/quote-requests": ok(emptyPage),
    "GET /api/v1/admin/enquiries": ok(emptyPage),
    "GET /api/v1/admin/career-applications": ok(emptyPage),
  });

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("ed@mds.example");
  await page.getByLabel("Password").fill("pw");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: /Welcome/i })).toBeVisible();

  const sidebar = page.getByRole("navigation", { name: "Admin sections" });
  await expect(sidebar.getByRole("link", { name: "Services" })).toBeVisible();
  // ContentManager has no quotations/users perms -> those links are absent
  await expect(sidebar.getByRole("link", { name: "Quote requests" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Users" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a stale /admin deep link after logout returns to login", async ({ page }) => {
  await stubApi(page, {
    "GET /api/v1/auth/session": (route) => route.fulfill({ status: 401, json: err("x", "x") }),
  });
  await page.goto("/admin/password");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpassword/);
});
