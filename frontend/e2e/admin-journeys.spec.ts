import { expect, test } from "@playwright/test";

import { err, ok, page as paginated, stubApi } from "./support";

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

test("inbox: assign an enquiry, then add an internal note", async ({ page }) => {
  const triager = {
    ...EDITOR,
    permissions: ["contact.view_enquiry", "contact.change_enquiry", "contact.assign_enquiry"],
  };
  const enquiry = {
    id: 7,
    public_reference: "MDS-E-2026-000007",
    enquiry_type: "business",
    name: "Sam Client",
    email: "sam@example.com",
    phone: "",
    company: "",
    message: "Do you work in Qatar?",
    status: "new",
    allowed_transitions: ["assigned", "in_progress", "responded", "closed", "spam"],
    assigned_to: null,
    assigned_to_email: "",
    notes: [] as Array<Record<string, unknown>>,
    ip_address: null,
    user_agent: "",
    created_at: "2026-09-01T00:00:00Z",
  };

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(triager),
    "GET /api/v1/admin/enquiries": (route) => route.fulfill({ json: ok(paginated([enquiry])) }),
    "GET /api/v1/admin/enquiries/7": (route) => route.fulfill({ json: ok(enquiry) }),
    "PATCH /api/v1/admin/enquiries/7": async (route) => {
      const body = route.request().postDataJSON() as { status?: string; assigned_to?: number | null };
      if (body.status) enquiry.status = body.status;
      if ("assigned_to" in body) {
        enquiry.assigned_to = body.assigned_to ?? null;
        enquiry.assigned_to_email = body.assigned_to ? "ed@mds.example" : "";
      }
      return route.fulfill({ json: ok(enquiry) });
    },
    "POST /api/v1/admin/enquiries/7/notes": async (route) => {
      const { note } = route.request().postDataJSON() as { note: string };
      const row = { id: enquiry.notes.length + 1, note, author: 1, author_email: "ed@mds.example", created_at: "2026-09-02T00:00:00Z" };
      enquiry.notes = [row, ...enquiry.notes];
      return route.fulfill({ status: 201, json: ok(row) });
    },
  });

  await page.goto("/admin/enquiries");
  await page.getByText("MDS-E-2026-000007").click();

  const drawer = page.getByRole("dialog", { name: "MDS-E-2026-000007" });
  await expect(drawer.getByText("Do you work in Qatar?")).toBeVisible();

  await drawer.getByRole("combobox", { name: "Status" }).selectOption("assigned");
  await drawer.getByRole("spinbutton", { name: /Assigned to/ }).fill("1");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByText("Currently ed@mds.example")).toBeVisible();

  await drawer.getByRole("textbox", { name: "Add a note" }).fill("Emailed the Qatar team.");
  await drawer.getByRole("button", { name: "Add note" }).click();
  await expect(drawer.getByText("Emailed the Qatar team.")).toBeVisible();
});

test("media: pick a library image for a service's hero image", async ({ page }) => {
  const editor = {
    ...EDITOR,
    permissions: [
      "services.view_service",
      "services.change_service",
      "media.view_mediaasset",
    ],
  };
  const service = {
    id: 9,
    name: "Rebar Detailing",
    slug: "rebar-detailing",
    short_description: "",
    long_description: "",
    business_value: "",
    standards_codes: "",
    deliverables: "",
    output_formats: "",
    display_order: 0,
    hero_image: null as number | null,
    icon: null,
    og_image: null,
    technology: [] as string[],
    status: "draft",
    allowed_transitions: ["review"],
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
  const image = {
    id: 5,
    document: 10,
    document_status: "processed",
    url: "https://cdn.example/cage.png",
    alt_text: "Reinforcement cage",
    caption: "",
    width: 1200,
    height: 800,
    created_at: "2026-09-01T00:00:00Z",
  };
  let patched: Record<string, unknown> | undefined;

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(editor),
    "GET /api/v1/admin/services": (route) => route.fulfill({ json: ok(paginated([service])) }),
    "GET /api/v1/admin/services/9": (route) => route.fulfill({ json: ok(service) }),
    "GET /api/v1/admin/services/9/versions": ok(paginated([])),
    "GET /api/v1/admin/media": (route) => route.fulfill({ json: ok(paginated([image])) }),
    "GET /api/v1/admin/media/5": ok(image),
    "PATCH /api/v1/admin/services/9": async (route) => {
      patched = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: ok({ ...service, hero_image: 5 }) });
    },
  });

  await page.goto("/admin/services");
  await page.getByText("Rebar Detailing").click();

  const drawer = page.getByRole("dialog", { name: "Edit" });
  await drawer
    .getByRole("group", { name: "Hero image" })
    .getByRole("button", { name: "Choose image" })
    .click();

  const picker = page.getByRole("dialog", { name: "Choose an image" });
  await picker.getByRole("button", { name: /Reinforcement cage/ }).click();
  await expect(picker).toBeHidden();

  await drawer.getByRole("button", { name: "Save changes" }).click();
  await expect(drawer).toBeHidden();
  expect(patched?.hero_image).toBe(5);
});

test("a stale /admin deep link after logout returns to login", async ({ page }) => {
  await stubApi(page, {
    "GET /api/v1/auth/session": (route) => route.fulfill({ status: 401, json: err("x", "x") }),
  });
  await page.goto("/admin/password");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpassword/);
});

test("users: an admin deactivates a user", async ({ page }) => {
  const admin = {
    ...EDITOR,
    id: 1,
    email: "admin@mds.example",
    roles: ["Admin"],
    permissions: ["users.view_user", "users.add_user", "users.change_user", "auth.view_group"],
  };
  const sam = {
    id: 5,
    email: "sam@mds.example",
    first_name: "Sam",
    last_name: "Staff",
    full_name: "Sam Staff",
    is_active: true,
    is_staff: true,
    roles: ["HR"],
    is_locked: false,
    last_login: null,
    last_login_ip: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };
  let patched: Record<string, unknown> | undefined;

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(admin),
    "GET /api/v1/admin/roles": ok(paginated([{ id: 1, name: "HR", permissions: [], user_count: 1 }])),
    "GET /api/v1/admin/users": (route) => route.fulfill({ json: ok(paginated([sam])) }),
    "PATCH /api/v1/admin/users/5": (route) => {
      patched = route.request().postDataJSON() as Record<string, unknown>;
      Object.assign(sam, patched);
      return route.fulfill({ json: ok(sam) });
    },
  });

  await page.goto("/admin/users");
  const row = page.getByRole("row", { name: /sam@mds\.example/ });
  await expect(row.getByText("Active")).toBeVisible();
  await row.click();

  const drawer = page.getByRole("dialog", { name: "sam@mds.example" });
  await drawer.getByRole("button", { name: "Deactivate user" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Deactivate this user?" });
  await confirm.getByRole("button", { name: "Deactivate" }).click();

  await expect(drawer).toBeHidden();
  expect(patched).toEqual({ is_active: false });
  await expect(row.getByText("Inactive")).toBeVisible();
});

test("audit: an auditor reads the log but gets no write controls", async ({ page }) => {
  const auditor = { ...EDITOR, roles: ["Auditor"], permissions: ["audit.view_auditlog"] };
  const entry = {
    id: 10,
    action: "user.updated",
    entity_type: "users.User",
    entity_id: "5",
    actor: 1,
    actor_email: "admin@mds.example",
    before: { is_active: true },
    after: { is_active: false },
    ip_address: "10.0.0.1",
    user_agent: "Firefox",
    timestamp: "2026-09-02T10:00:00Z",
  };

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(auditor),
    "GET /api/v1/admin/audit": ok({ next: null, previous: null, results: [entry] }),
  });

  await page.goto("/admin/audit");
  const sidebar = page.getByRole("navigation", { name: "Admin sections" });
  await expect(sidebar.getByRole("link", { name: "Audit log" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Users" })).toHaveCount(0);

  await page.getByText("user.updated").click();
  const drawer = page.getByRole("dialog", { name: "user.updated — users.User #5" });
  await expect(drawer.getByText("admin@mds.example")).toBeVisible();
  await expect(drawer.locator(".audit-diff__row--changed")).toHaveText(/is_active.*true.*false/);
  await expect(drawer.getByRole("button", { name: /save|delete|edit/i })).toHaveCount(0);

  // A forbidden screen renders the 403 panel rather than the page.
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Not permitted" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Users" })).toHaveCount(0);
});
