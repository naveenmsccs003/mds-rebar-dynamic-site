import type { Page, Route } from "@playwright/test";

/** Backend success envelope (docs/API_DESIGN.md). */
export const ok = (data: unknown, meta: Record<string, unknown> = {}) => ({
  success: true,
  data,
  message: "",
  meta,
});

export const err = (code: string, message: string, fields: Record<string, string[]> = {}) => ({
  success: false,
  error: { code, message, fields },
});

export const page = <T>(results: T[], extra: Record<string, unknown> = {}) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
  ...extra,
});

type Handler = (route: Route, url: URL) => unknown;

/**
 * Route every `/api/v1/*` call. `routes` is matched by
 * `"<METHOD> <pathname>"`; an unmatched call fails loudly so a spec
 * can't silently pass against a real/missing backend.
 */
export async function stubApi(p: Page, routes: Record<string, Handler | object>) {
  await p.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = `${req.method()} ${url.pathname.replace(/\/$/, "")}`;
    const match =
      routes[key] ??
      routes[Object.keys(routes).find((k) => key.startsWith(k.replace(/\*$/, ""))) ?? ""];
    if (match === undefined) {
      return route.fulfill({ status: 599, body: `no stub for ${key}` });
    }
    if (typeof match === "function") return match(route, url);
    return route.fulfill({ json: match });
  });
}
