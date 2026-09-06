import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "../../api/envelope";
import { ApiRequestError } from "../../api/request";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { ResourceListTemplate } from "./ResourceListTemplate";
import type { ResourceListItem } from "./types";

vi.mock("./api");
const getResources = vi.mocked(api.getResources);
const getResourceDownload = vi.mocked(api.getResourceDownload);
afterEach(() => vi.resetAllMocks());

const item = (o: Partial<ResourceListItem> = {}): ResourceListItem => ({
  id: 1,
  title: "Company Brochure",
  slug: "company-brochure",
  description: "Everything about us.",
  category: "brochure",
  access_type: "public",
  published_date: null,
  external_url: "",
  thumbnail: null,
  has_file: true,
  ...o,
});

function renderList(results: ResourceListItem[]) {
  getResources.mockResolvedValue({
    count: results.length,
    next: null,
    previous: null,
    results,
  } satisfies Paginated<ResourceListItem>);
  return renderWithProviders(<ResourceListTemplate />, { route: "/resources" });
}

describe("ResourceListTemplate downloads", () => {
  const assign = vi.fn();
  beforeEach(() => {
    assign.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
    });
  });

  it("shows a Download button only for resources with a file", async () => {
    renderList([item({ id: 1 }), item({ id: 2, slug: "no-file", title: "Link only", has_file: false })]);
    const buttons = await screen.findAllByRole("button", { name: /Download/i });
    expect(buttons).toHaveLength(1);
  });

  it("resolves a signed URL and navigates to it", async () => {
    getResourceDownload.mockResolvedValue({ url: "https://files.example/d/abc", expires_in: 300 });
    renderList([item()]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Download/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://files.example/d/abc"));
    expect(getResourceDownload).toHaveBeenCalledWith("company-brochure");
  });

  it("explains a 403 on a restricted resource", async () => {
    getResourceDownload.mockRejectedValue(
      new ApiRequestError("Forbidden", "PERMISSION_DENIED", {}, 403),
    );
    renderList([item({ access_type: "restricted" })]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Download/i }));

    expect(await screen.findByText(/Knowledge Base account/i)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
