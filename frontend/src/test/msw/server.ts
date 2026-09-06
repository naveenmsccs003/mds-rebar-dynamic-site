/**
 * MSW server for API-integration tests (docs/TESTING.md "API integration
 * tests against a mocked API layer (MSW)"). Started once in
 * `src/test/setup.ts`; individual tests register handlers with
 * `server.use(...)`.
 *
 * `onUnhandledRequest: "bypass"` so it coexists with the many suites
 * that mock the feature `api.ts` modules directly and never hit HTTP.
 */
import { setupServer } from "msw/node";

export const server = setupServer();

export const API_BASE = "http://localhost:8000/api/v1";

/** The backend success envelope (docs/API_DESIGN.md). */
export function ok<T>(data: T, meta: Record<string, unknown> = {}) {
  return { success: true, data, message: "", meta };
}

/** The backend error envelope. */
export function err(code: string, message: string, fields: Record<string, string[]> = {}) {
  return { success: false, error: { code, message, fields } };
}
