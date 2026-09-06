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

test("CMS: open a section, submit it for review, see version history", async ({ page }) => {
  const section = {
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
  };
  const editor = {
    ...EDITOR,
    permissions: [
      "pages.view_pagesection",
      "pages.change_pagesection",
      "pages.add_pagesection",
    ],
  };

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(editor),
    "GET /api/v1/admin/cms/sections": ok({ count: 1, next: null, previous: null, results: [section] }),
    "GET /api/v1/admin/cms/sections/1": ok(section),
    "GET /api/v1/admin/cms/sections/1/versions": ok({
      count: 1,
      next: null,
      previous: null,
      results: [
        { id: 5, snapshot: {}, note: "created", edited_by_email: "ed@mds.example", edited_at: "2026-09-01T00:00:00Z" },
      ],
    }),
    "POST /api/v1/admin/cms/sections/1/transition": (route) =>
      route.fulfill({ json: ok({ ...section, status: "review", allowed_transitions: ["draft", "approved"] }) }),
  });

  await page.goto("/admin/cms/sections");
  await page.getByText("hero").click();

  const drawer = page.getByRole("dialog", { name: /edit home\/hero/i });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/created/)).toBeVisible(); // version history row

  await drawer.getByRole("button", { name: "Submit for review" }).click();
  // the drawer closes on success and the list stays put
  await expect(drawer).toBeHidden();
});

test("catalogue: create a service, then publish it via the workflow bar", async ({ page }) => {
  const publisher = {
    ...EDITOR,
    permissions: [
      "services.view_service",
      "services.add_service",
      "services.change_service",
      "services.publish_service",
    ],
  };
  const draft = {
    id: 9,
    name: "Estimation",
    slug: "estimation",
    short_description: "",
    long_description: "",
    business_value: "",
    standards_codes: "",
    deliverables: "",
    output_formats: "",
    display_order: 0,
    hero_image: null,
    icon: null,
    og_image: null,
    technology: [],
    status: "approved",
    allowed_transitions: ["draft", "published", "archived"],
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
  let created = false;

  await stubApi(page, { "GET /api/v1/auth/session": ok(publisher) });
  // richer stateful stub than the helper supports — registered after
  // stubApi so this more specific route wins.
  await page.route("**/api/v1/admin/services/**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "GET" && url.pathname.endsWith("/services/")) {
      return route.fulfill({
        json: ok({ count: created ? 1 : 0, next: null, previous: null, results: created ? [draft] : [] }),
      });
    }
    if (req.method() === "POST" && url.pathname.endsWith("/services/")) {
      created = true;
      return route.fulfill({ status: 201, json: ok(draft) });
    }
    if (url.pathname.endsWith("/9/versions/")) {
      return route.fulfill({ json: ok({ count: 0, next: null, previous: null, results: [] }) });
    }
    if (url.pathname.endsWith("/9/transition/")) {
      return route.fulfill({ json: ok({ ...draft, status: "published", allowed_transitions: ["draft", "archived"] }) });
    }
    return route.fulfill({ status: 599, body: `unmatched ${req.method()} ${url.pathname}` });
  });

  await page.goto("/admin/services");
  await page.getByRole("button", { name: "New" }).click();
  const drawer = page.getByRole("dialog", { name: "New" });
  await drawer.getByLabel("Name", { exact: true }).fill("Estimation");
  await drawer.getByLabel("Slug", { exact: true }).fill("estimation");
  await drawer.getByRole("button", { name: "Create" }).click();
  await expect(drawer).toBeHidden();

  // reload the list — the new row is now there; open it and publish
  await page.goto("/admin/services");
  const row = page.getByRole("cell", { name: "Estimation", exact: true });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();

  const editDrawer = page.getByRole("dialog", { name: "Edit" });
  await expect(editDrawer.getByText("Status:")).toBeVisible();
  await editDrawer.getByRole("button", { name: "Publish" }).click();
  await expect(editDrawer).toBeHidden();
});

test("a stale /admin deep link after logout returns to login", async ({ page }) => {
  await stubApi(page, {
    "GET /api/v1/auth/session": (route) => route.fulfill({ status: 401, json: err("x", "x") }),
  });
  await page.goto("/admin/password");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpassword/);
});
