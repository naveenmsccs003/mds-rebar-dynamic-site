import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config (docs/TESTING.md "End-to-end (Playwright)"). The public
 * journeys run against the built SPA (`vite preview`) with the API
 * stubbed per test via `page.route` — no backend, Postgres or Redis
 * needed, so they run anywhere including CI. Journeys that need the real
 * admin SPA + backend (login, RBAC, publishing, user/permission
 * management, audit visibility) are added when the admin app ships.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
