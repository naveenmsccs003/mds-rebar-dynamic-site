import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config (docs/TESTING.md "End-to-end (Playwright)").
 *
 * Default: the public journeys run against the built SPA
 * (`vite preview`) with the API stubbed per test via `page.route` — no
 * backend needed, runs anywhere including CI. Journeys that need the
 * real admin SPA + backend (login, RBAC, publishing, user/permission
 * management, audit visibility) are added when the admin app ships.
 *
 * `SMOKE_BASE_URL` set: point at a deployed environment instead (the
 * `deploy-staging` job's smoke step, docs/CI_CD.md) — no local server is
 * started; select `e2e/smoke.spec.ts` only.
 */
const smokeBaseUrl = process.env.SMOKE_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  // Default run = the stubbed public journeys; smoke.spec is deploy-only.
  testMatch: smokeBaseUrl ? ["smoke.spec.ts"] : ["**/*.spec.ts"],
  testIgnore: smokeBaseUrl ? [] : ["smoke.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: smokeBaseUrl ?? "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: smokeBaseUrl
    ? undefined
    : {
        command: "npm run build && npm run preview -- --port 4173 --strictPort",
        url: "http://localhost:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
