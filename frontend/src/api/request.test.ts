/**
 * Tests the real network layer (`api/request.ts` + the axios client)
 * against MSW — the envelope unwrap and error mapping that the
 * `vi.mock("./api")`-style feature tests bypass entirely.
 */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { API_BASE, err, ok, server } from "../test/msw/server";
import { ApiRequestError, apiGet, apiPost } from "./request";

describe("apiGet / apiPost", () => {
  it("unwraps the success envelope to plain data", async () => {
    server.use(http.get(`${API_BASE}/widgets/`, () => HttpResponse.json(ok({ id: 1, name: "W" }))));
    await expect(apiGet("/widgets/")).resolves.toEqual({ id: 1, name: "W" });
  });

  it("forwards query params", async () => {
    server.use(
      http.get(`${API_BASE}/widgets/`, ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json(ok({ q: url.searchParams.get("q") }));
      }),
    );
    await expect(apiGet("/widgets/", { q: "rebar" })).resolves.toEqual({ q: "rebar" });
  });

  it("turns an error envelope into a typed ApiRequestError with fields + status", async () => {
    server.use(
      http.post(`${API_BASE}/widgets/`, () =>
        HttpResponse.json(err("VALIDATION_ERROR", "Validation failed.", { name: ["Required."] }), {
          status: 400,
        }),
      ),
    );
    await expect(apiPost("/widgets/", {})).rejects.toMatchObject({
      name: "ApiRequestError",
      code: "VALIDATION_ERROR",
      fields: { name: ["Required."] },
      status: 400,
    });
  });

  it("maps a non-envelope 500 to a NETWORK_ERROR ApiRequestError", async () => {
    server.use(
      http.get(`${API_BASE}/widgets/`, () => new HttpResponse("boom", { status: 500 })),
    );
    const error = await apiGet("/widgets/").catch((e) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(500);
  });

  it("maps a transport failure to a NETWORK_ERROR", async () => {
    server.use(http.get(`${API_BASE}/widgets/`, () => HttpResponse.error()));
    await expect(apiGet("/widgets/")).rejects.toMatchObject({
      name: "ApiRequestError",
      code: "NETWORK_ERROR",
    });
  });
});
