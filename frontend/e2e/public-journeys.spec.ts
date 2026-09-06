import { expect, test } from "@playwright/test";

import { err, ok, page as paginate, stubApi } from "./support";

test("home page renders and the primary nav links to the public sections", async ({ page }) => {
  await stubApi(page, { "GET /api/v1/pages/home": ok([]) });
  await page.goto("/");
  const primary = page.getByRole("navigation", { name: "Primary" });
  await expect(primary.getByRole("link", { name: "Careers" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
});

test("global search: query in the URL, results, and a result link", async ({ page }) => {
  await stubApi(page, {
    "GET /api/v1/search": (route, url) =>
      route.fulfill({
        json: ok({
          query: url.searchParams.get("q"),
          results: [
            { type: "service", title: "Rebar Detailing", url: "/services/rebar-detailing", snippet: "Shop drawings.", score: 2 },
          ],
          count: 1,
          page: 1,
          num_pages: 1,
          page_size: 20,
        }),
      }),
  });

  await page.goto("/search");
  await page.getByRole("searchbox").fill("rebar");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/search\?q=rebar/);
  await expect(page.getByText("1 result for “rebar”")).toBeVisible();
  await expect(page.getByRole("link", { name: "Rebar Detailing" })).toHaveAttribute(
    "href",
    "/services/rebar-detailing",
  );
});

test("contact form: validation, then a successful submission shows the reference", async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await stubApi(page, {
    "POST /api/v1/contact": async (route) => {
      posted = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: ok({ reference: "MDS-E-2026-000009", status: "new" }) });
    },
  });

  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();

  await page.getByLabel("Full name").fill("Jane Roe");
  await page.getByLabel("Email").fill("jane@example.com");
  await page.getByLabel("Message").fill("Please get in touch.");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("Message received")).toBeVisible();
  await expect(page.getByText("MDS-E-2026-000009")).toBeVisible();
  expect(posted).toMatchObject({ name: "Jane Roe", message: "Please get in touch." });
});

test("careers: list → detail → the application form validates required fields", async ({ page }) => {
  const job = {
    id: 1,
    title: "Rebar Detailer",
    slug: "rebar-detailer",
    department: "Detailing",
    location: "Dubai",
    employment_type: "full_time",
    experience: "3-5 years",
    application_deadline: null,
    is_open: true,
    created_at: "2026-09-01T00:00:00Z",
  };
  await stubApi(page, {
    "GET /api/v1/careers": paginate([job]),
    "GET /api/v1/careers/rebar-detailer": ok({
      ...job,
      skills: "AutoCAD",
      skills_list: ["AutoCAD"],
      description: "Detail reinforcement drawings.",
      responsibilities: "",
      requirements: "",
      benefits: "",
      updated_at: "2026-09-01T00:00:00Z",
    }),
    "POST /api/v1/career-applications": err("VALIDATION_ERROR", "Validation failed.", {
      resume: ["A résumé file is required."],
    }),
  });

  await page.goto("/careers");
  await page.getByRole("link", { name: /Rebar Detailer/ }).click();
  await expect(page).toHaveURL(/\/careers\/rebar-detailer$/);
  await expect(page.getByRole("heading", { level: 1, name: "Rebar Detailer" })).toBeVisible();

  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Attach your résumé.")).toBeVisible();
});
