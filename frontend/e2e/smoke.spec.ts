/**
 * Post-deploy smoke tests (docs/CI_CD.md "Smoke tests" — "home loads,
 * login works, health endpoint OK"). Run against a live environment via
 * `SMOKE_BASE_URL`; hits the real stack, so keep it tiny and read-only.
 */
import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});

test("the backend health + readiness endpoints are OK", async ({ request }) => {
  const base = new URL(test.info().project.use.baseURL ?? "http://localhost:4173");
  // In a real deploy the API is a sibling host; allow an override.
  const apiBase = process.env.SMOKE_API_URL ?? `${base.protocol}//${base.host}`;
  expect((await request.get(`${apiBase}/health/`)).ok()).toBeTruthy();
  expect((await request.get(`${apiBase}/ready/`)).ok()).toBeTruthy();
});

test("the public content API answers", async ({ request }) => {
  const base = new URL(test.info().project.use.baseURL ?? "http://localhost:4173");
  const apiBase = process.env.SMOKE_API_URL ?? `${base.protocol}//${base.host}`;
  const res = await request.get(`${apiBase}/api/v1/services/`);
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).success).toBe(true);
});
