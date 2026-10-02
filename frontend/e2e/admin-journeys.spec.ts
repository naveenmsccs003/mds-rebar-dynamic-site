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

// --- A7: remaining TESTING.md journeys + keyboard operation -------------

test("RBAC: a BD user can't close a quote, and a move the server refuses shows its error", async ({ page }) => {
  const bd = {
    ...EDITOR,
    roles: ["BusinessDevelopment"],
    permissions: ["quotations.view_quoterequest", "quotations.change_quoterequest", "quotations.assign_quoterequest"],
  };
  const quote = {
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
    status: "assigned",
    allowed_transitions: ["in_progress", "closed", "spam"],
    assigned_to: 1,
    assigned_to_email: "ed@mds.example",
    ip_address: null,
    user_agent: "",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(bd),
    "GET /api/v1/admin/quote-requests": ok(paginated([quote])),
    "GET /api/v1/admin/quote-requests/1": ok(quote),
    "PATCH /api/v1/admin/quote-requests/1": (route) =>
      route.fulfill({ status: 403, json: err("PERMISSION_DENIED", "You do not have permission to perform this action.") }),
  });

  await page.goto("/admin/quote-requests");
  await page.getByText("MDS-Q-2026-000001").click();
  const drawer = page.getByRole("dialog", { name: "MDS-Q-2026-000001" });
  const status = drawer.getByRole("combobox", { name: "Status" });
  const save = drawer.getByRole("button", { name: "Save" });

  // UI gate: closing needs quotations.close_quoterequest -> Save disabled, reason shown.
  await status.selectOption("closed");
  await expect(drawer.getByRole("alert")).toContainText("quotations.close_quoterequest");
  await expect(save).toBeDisabled();

  // Server gate: an allowed-looking move the API refuses surfaces the 403 message.
  await status.selectOption("in_progress");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(drawer.getByRole("alert")).toContainText("You do not have permission");
  await expect(drawer).toBeVisible();
});

test("file upload: upload an image to the media library (declare → PUT → complete → asset)", async ({ page }) => {
  const manager = { ...EDITOR, roles: ["ResourceManager"], permissions: ["media.view_mediaasset", "media.add_mediaasset", "media.change_mediaasset"] };
  const assets: Array<Record<string, unknown>> = [];
  const calls: string[] = [];

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(manager),
    "GET /api/v1/admin/media": (route) => route.fulfill({ json: ok(paginated(assets)) }),
    "POST /api/v1/admin/documents/upload": (route) => {
      calls.push("declare");
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({ category: "image", filename: "rebar.png", visibility: "public" });
      return route.fulfill({
        status: 201,
        json: ok({
          document: "doc-uuid",
          upload: { url: "http://localhost:8000/api/v1/uploads/tok", method: "PUT", headers: {}, expires_in: 600 },
        }),
      });
    },
    "PUT /api/v1/uploads/tok": (route) => {
      calls.push("put");
      return route.fulfill({ status: 204, body: "" });
    },
    "POST /api/v1/admin/documents/doc-uuid/complete": (route) => {
      calls.push("complete");
      return route.fulfill({
        json: ok({ id: 42, uuid: "doc-uuid", original_filename: "rebar.png", content_type: "image/png", size_bytes: 68, visibility: "public", status: "pending" }),
      });
    },
    "POST /api/v1/admin/media": (route) => {
      calls.push("asset");
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const row = { id: 9, document: body.document, document_status: "pending", url: null, alt_text: body.alt_text, caption: "", width: null, height: null, created_at: "2026-09-02T00:00:00Z" };
      assets.push(row);
      return route.fulfill({ status: 201, json: ok(row) });
    },
  });

  await page.goto("/admin/media");
  await expect(page.getByText("No images yet.")).toBeVisible();
  await page.getByRole("button", { name: "Upload image" }).click();

  const drawer = page.getByRole("dialog", { name: "Upload image" });
  await drawer.getByLabel("Image file").setInputFiles({
    name: "rebar.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex"),
  });
  await drawer.getByLabel("Alt text").fill("Rebar cage on site");
  await drawer.getByRole("button", { name: "Upload image" }).click();

  await expect(drawer).toBeHidden();
  expect(calls).toEqual(["declare", "put", "complete", "asset"]);
  // Newly uploaded files show as pending until the virus scan clears them.
  await expect(page.getByRole("button", { name: /Rebar cage on site/ })).toContainText("scanning…");
});

test("private files: HR gets a signed résumé link only once the scan is clean", async ({ page }) => {
  const hr = {
    ...EDITOR,
    roles: ["HR"],
    permissions: ["applications.view_jobapplication", "applications.change_jobapplication"],
  };
  const application = {
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
    resume_status: "pending",
    status: "new",
    assigned_to: null,
    assigned_to_email: "",
    ip_address: null,
    user_agent: "",
    created_at: "2026-09-01T00:00:00Z",
  };
  let scanned = false;

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(hr),
    "GET /api/v1/admin/career-applications": ok(paginated([application])),
    "GET /api/v1/admin/career-applications/3": ok(application),
    "GET /api/v1/admin/career-applications/3/resume": (route) =>
      scanned
        ? route.fulfill({ json: ok({ url: "https://files.example/pat-cv.pdf?sig=abc", expires_in: 120 }) })
        : route.fulfill({ status: 409, json: err("CONFLICT", "The résumé is still being scanned.") }),
  });

  await page.goto("/admin/applications");
  const sidebar = page.getByRole("navigation", { name: "Admin sections" });
  await expect(sidebar.getByRole("link", { name: "Applications" })).toBeVisible();
  await page.getByText("Pat Applicant").click();

  const drawer = page.getByRole("dialog", { name: "Pat Applicant — Rebar Detailer" });
  await drawer.getByRole("button", { name: "Get résumé link" }).click();
  await expect(drawer.getByRole("alert")).toContainText("still being scanned");
  await expect(drawer.getByRole("link", { name: /Download/ })).toHaveCount(0);

  scanned = true;
  await drawer.getByRole("button", { name: "Get résumé link" }).click();
  await expect(drawer.getByRole("link", { name: /Download pat-cv\.pdf/ })).toHaveAttribute(
    "href",
    "https://files.example/pat-cv.pdf?sig=abc",
  );
});

test("private files: a role without the HR permission is refused the applications screen", async ({ page }) => {
  await stubApi(page, { "GET /api/v1/auth/session": ok(EDITOR) });
  await page.goto("/admin/applications");
  await expect(page.getByRole("heading", { name: "Not permitted" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Applications" }),
  ).toHaveCount(0);
});

test("permissions: an admin creates a user with a role and checks what that role grants", async ({ page }) => {
  const admin = {
    ...EDITOR,
    id: 1,
    roles: ["Admin"],
    permissions: ["users.view_user", "users.add_user", "users.change_user", "auth.view_group"],
  };
  const roles = [
    { id: 1, name: "HR", permissions: ["applications.change_jobapplication", "applications.view_jobapplication", "careers.view_jobposting"], user_count: 0 },
    { id: 2, name: "Staff", permissions: [], user_count: 3 },
  ];
  const users: Array<Record<string, unknown>> = [];
  let posted: Record<string, unknown> | undefined;

  await stubApi(page, {
    "GET /api/v1/auth/session": ok(admin),
    "GET /api/v1/admin/roles": ok(paginated(roles)),
    "GET /api/v1/admin/users": (route) => route.fulfill({ json: ok(paginated(users)) }),
    "POST /api/v1/admin/users": (route) => {
      posted = route.request().postDataJSON() as Record<string, unknown>;
      const row = {
        id: 8, email: posted.email, first_name: posted.first_name, last_name: "", full_name: posted.first_name,
        is_active: true, is_staff: true, roles: posted.roles, is_locked: false, last_login: null,
        last_login_ip: null, created_at: "2026-09-02T00:00:00Z", updated_at: "2026-09-02T00:00:00Z",
      };
      users.push(row);
      return route.fulfill({ status: 201, json: ok(row) });
    },
  });

  await page.goto("/admin/roles");
  await page.getByText("HR", { exact: true }).click();
  const roleDrawer = page.getByRole("dialog", { name: "HR" });
  await expect(roleDrawer.getByRole("region", { name: "applications" })).toContainText("view_jobapplication");
  await roleDrawer.getByRole("button", { name: "Close" }).click();

  await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Users" }).click();
  await page.getByRole("button", { name: "New user" }).click();
  const drawer = page.getByRole("dialog", { name: "New user" });
  await drawer.getByLabel("Email").fill("pat.hr@mds.example");
  await drawer.getByLabel("First name").fill("Pat");
  await drawer.getByRole("checkbox", { name: "HR" }).check();
  await drawer.getByRole("button", { name: "Create user" }).click();

  await expect(page.getByRole("status")).toContainText("set-password email");
  expect(posted).toMatchObject({ email: "pat.hr@mds.example", roles: ["HR"] });
  expect(posted).not.toHaveProperty("password");
  await expect(page.getByRole("row", { name: /pat\.hr@mds\.example/ })).toContainText("HR");
});

test("keyboard: open a row, stay inside the drawer, Escape returns focus to the row", async ({ page }) => {
  const admin = { ...EDITOR, id: 1, roles: ["Admin"], permissions: ["users.view_user", "users.change_user", "auth.view_group"] };
  const sam = {
    id: 5, email: "sam@mds.example", first_name: "Sam", last_name: "Staff", full_name: "Sam Staff",
    is_active: true, is_staff: true, roles: [], is_locked: false, last_login: null, last_login_ip: null,
    created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  };
  await stubApi(page, {
    "GET /api/v1/auth/session": ok(admin),
    "GET /api/v1/admin/roles": ok(paginated([])),
    "GET /api/v1/admin/users": ok(paginated([sam])),
  });

  await page.goto("/admin/users");
  const row = page.getByRole("row", { name: /sam@mds\.example/ });
  await row.focus();
  await page.keyboard.press("Enter");

  const drawer = page.getByRole("dialog", { name: "sam@mds.example" });
  await expect(drawer).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(row).toBeFocused();
});
