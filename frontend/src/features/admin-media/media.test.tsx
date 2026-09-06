import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { API_BASE, ok, server } from "../../test/msw/server";
import { MediaLibraryPage } from "./MediaLibraryPage";
import { MediaPicker } from "./MediaPicker";
import { uploadImage } from "./upload";
import type { MediaAssetRow } from "./types";

vi.mock("../auth/usePermission", () => ({
  usePermission: () => true,
  usePermissionChecker: () => () => true,
}));

const MEDIA = `${API_BASE}/admin/media/`;
const UPLOAD = `${API_BASE}/admin/documents/upload/`;
const FILES = "http://localhost:8000/api/v1/files/u/tok123/";

const asset = (o: Partial<MediaAssetRow> = {}): MediaAssetRow => ({
  id: 1,
  document: 10,
  document_status: "processed",
  url: "https://cdn.example/hero.png",
  alt_text: "Hero image",
  caption: "",
  width: 1200,
  height: 800,
  created_at: "2026-09-01T00:00:00Z",
  ...o,
});

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("uploadImage", () => {
  it("declares the upload, PUTs the bytes, then completes — returning the Document pk", async () => {
    const seen: string[] = [];
    server.use(
      http.post(UPLOAD, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        seen.push(`declare:${body.category}:${body.visibility}`);
        return HttpResponse.json(
          ok({ document: "uuid-1", upload: { url: "/api/v1/files/u/tok123/", method: "PUT", headers: {}, expires_in: 60 } }),
          { status: 201 },
        );
      }),
      http.put(FILES, () => {
        seen.push("put");
        return HttpResponse.json(ok({ received: 4 }));
      }),
      http.post(`${API_BASE}/admin/documents/uuid-1/complete/`, () => {
        seen.push("complete");
        return HttpResponse.json(ok({ id: 42, uuid: "uuid-1", original_filename: "p.png", status: "pending" }));
      }),
    );

    const doc = await uploadImage(new File(["data"], "p.png", { type: "image/png" }));
    expect(doc.id).toBe(42);
    expect(seen).toEqual(["declare:image:public", "put", "complete"]);
  });
});

describe("MediaLibraryPage", () => {
  it("shows the grid and saves an alt-text edit", async () => {
    let patched: Record<string, unknown> | undefined;
    server.use(
      http.get(MEDIA, () => HttpResponse.json(ok({ count: 1, next: null, previous: null, results: [asset()] }))),
      http.patch(`${MEDIA}1/`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ok(asset({ alt_text: "Reinforcement cage" })));
      }),
    );

    render(<MediaLibraryPage />, { wrapper: wrap() });
    const card = await screen.findByRole("button", { name: /Hero image/ });
    await userEvent.click(card);

    const dialog = await screen.findByRole("dialog", { name: "Hero image" });
    const d = within(dialog);
    const altField = d.getByLabelText("Alt text");
    await userEvent.clear(altField);
    await userEvent.type(altField, "Reinforcement cage");
    await userEvent.click(d.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patched).toEqual({ alt_text: "Reinforcement cage", caption: "" }));
  });
});

describe("MediaPicker", () => {
  it("shows the current pick and swaps it for one chosen from the library", async () => {
    server.use(
      http.get(`${MEDIA}1/`, () => HttpResponse.json(ok(asset()))),
      http.get(MEDIA, () =>
        HttpResponse.json(
          ok({ count: 1, next: null, previous: null, results: [asset({ id: 2, alt_text: "Bridge deck", url: "https://cdn.example/bridge.png" })] }),
        ),
      ),
    );
    const onChange = vi.fn();
    render(
      <MediaPicker name="hero_image" label="Hero image" value={1} onChange={onChange} />,
      { wrapper: wrap() },
    );

    expect(await screen.findByRole("img", { name: "Hero image" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    const dialog = await screen.findByRole("dialog", { name: "Choose an image" });
    await userEvent.click(await within(dialog).findByRole("button", { name: /Bridge deck/ }));

    expect(onChange).toHaveBeenCalledWith(2);
  });
});
