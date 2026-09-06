import "@testing-library/jest-dom/vitest";

import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw/server";

// MSW is opt-in per test (server.use(...)); unmatched requests pass
// through so suites that mock ./api directly are unaffected.
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
