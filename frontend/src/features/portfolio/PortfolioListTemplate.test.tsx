import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Paginated } from "../../api/envelope";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as servicesApi from "../services/api";
import * as api from "./api";
import { PortfolioListTemplate } from "./PortfolioListTemplate";
import type { ProjectListItem } from "./types";

vi.mock("./api");
vi.mock("../services/api");
const getProjects = vi.mocked(api.getProjects);
const getServices = vi.mocked(servicesApi.getServices);

afterEach(() => vi.resetAllMocks());

function page(results: ProjectListItem[], count = results.length): Paginated<ProjectListItem> {
  return { count, next: null, previous: null, results };
}

const proj = (o: Partial<ProjectListItem>): ProjectListItem => ({
  id: 1,
  title: "Metro Tower",
  slug: "metro-tower",
  category: "Commercial",
  completion_year: 2025,
  is_featured: false,
  country: { id: 1, name: "United Arab Emirates", code: "AE" },
  client_industry: null,
  og_image: null,
  cover_image: null,
  ...o,
});

describe("PortfolioListTemplate", () => {
  it("renders a card per project with the total count", async () => {
    getServices.mockResolvedValue([]);
    getProjects.mockResolvedValue(page([proj({}), proj({ id: 2, title: "Bridge", slug: "bridge" })], 2));
    renderWithProviders(<PortfolioListTemplate />, { route: "/portfolio" });

    expect(await screen.findByRole("link", { name: /Metro Tower/ })).toHaveAttribute(
      "href",
      "/portfolio/metro-tower",
    );
    expect(screen.getByText("2 projects")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Portfolio — MDS Rebar"));
  });

  it("passes filter changes to the query", async () => {
    getServices.mockResolvedValue([]);
    getProjects.mockResolvedValue(page([proj({})]));
    renderWithProviders(<PortfolioListTemplate />, { route: "/portfolio" });
    await screen.findByRole("link", { name: /Metro Tower/ });

    await userEvent.click(screen.getByLabelText("Featured only"));
    await waitFor(() =>
      expect(getProjects).toHaveBeenLastCalledWith(expect.objectContaining({ featured: "true" })),
    );
  });

  it("shows the empty state when nothing matches", async () => {
    getServices.mockResolvedValue([]);
    getProjects.mockResolvedValue(page([], 0));
    renderWithProviders(<PortfolioListTemplate />, { route: "/portfolio" });
    expect(await screen.findByText(/No projects match those filters/i)).toBeInTheDocument();
  });
});
