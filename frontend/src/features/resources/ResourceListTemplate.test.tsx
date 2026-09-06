import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "../../api/envelope";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { ResourceListTemplate } from "./ResourceListTemplate";
import type { ResourceListItem } from "./types";

vi.mock("./api");
const getResources = vi.mocked(api.getResources);
afterEach(() => vi.resetAllMocks());

function page(results: ResourceListItem[]): Paginated<ResourceListItem> {
  return { count: results.length, next: null, previous: null, results };
}

const res = (o: Partial<ResourceListItem>): ResourceListItem => ({
  id: 1,
  title: "Company Brochure",
  slug: "company-brochure",
  description: "Overview of MDS Rebar",
  category: "brochure",
  access_type: "public",
  published_date: null,
  external_url: "https://example.com/brochure.pdf",
  thumbnail: null,
  ...o,
});

describe("ResourceListTemplate", () => {
  it("lists resources with category labels and an external link", async () => {
    getResources.mockResolvedValue(page([res({})]));
    renderWithProviders(<ResourceListTemplate />, { route: "/resources" });

    expect(await screen.findByRole("heading", { name: "Company Brochure" })).toBeInTheDocument();
    expect(screen.getByText("Brochure", { selector: "p.card__eyebrow" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open resource" })).toHaveAttribute(
      "href",
      "https://example.com/brochure.pdf",
    );
  });

  it("marks restricted resources", async () => {
    getResources.mockResolvedValue(
      page([res({ title: "Spec Sheet", slug: "spec", access_type: "restricted", external_url: "" })]),
    );
    renderWithProviders(<ResourceListTemplate />, { route: "/resources" });
    expect(await screen.findByRole("heading", { name: "Spec Sheet" })).toBeInTheDocument();
    expect(screen.getByText(/Restricted/)).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", async () => {
    getResources.mockResolvedValue(page([]));
    renderWithProviders(<ResourceListTemplate />, { route: "/resources" });
    expect(await screen.findByText(/No resources match those filters/i)).toBeInTheDocument();
  });
});
