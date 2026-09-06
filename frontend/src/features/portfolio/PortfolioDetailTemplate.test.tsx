import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";

import { ApiRequestError } from "../../api/request";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { PortfolioDetailTemplate } from "./PortfolioDetailTemplate";
import type { ProjectDetail } from "./types";

vi.mock("./api");
const getProject = vi.mocked(api.getProject);
afterEach(() => vi.resetAllMocks());

function renderDetail(slug = "metro-tower") {
  return renderWithProviders(
    <Routes>
      <Route path="/portfolio/:slug" element={<PortfolioDetailTemplate />} />
    </Routes>,
    { route: `/portfolio/${slug}` },
  );
}

const detail = (o: Partial<ProjectDetail> = {}): ProjectDetail => ({
  id: 1,
  title: "Metro Tower",
  slug: "metro-tower",
  category: "Commercial",
  completion_year: 2025,
  is_featured: true,
  country: { id: 1, name: "UAE", code: "AE" },
  client_industry: { id: 1, name: "Transport", slug: "transport" },
  og_image: null,
  cover_image: null,
  description: "<p>A <strong>landmark</strong> tower.</p>",
  services: [{ id: 1, name: "Rebar Detailing", slug: "rebar-detailing" }],
  technology: [{ id: 2, name: "Tekla", slug: "tekla" }],
  images: [
    {
      image: { id: 1, url: null, alt_text: "Facade", caption: "North face", width: null, height: null },
      display_order: 0,
    },
  ],
  documents: [{ id: 1, label: "Method statement", is_public: true }],
  seo_title: "",
  seo_description: "",
  updated_at: "2026-01-01T00:00:00Z",
  ...o,
});

describe("PortfolioDetailTemplate", () => {
  it("renders the project record", async () => {
    getProject.mockResolvedValue(detail());
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Metro Tower" })).toBeInTheDocument();
    expect(screen.getByText("landmark")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rebar Detailing" })).toHaveAttribute(
      "href",
      "/services/rebar-detailing",
    );
    expect(screen.getByText("Tekla")).toBeInTheDocument();
    expect(screen.getByText("Method statement")).toBeInTheDocument();
    expect(getProject).toHaveBeenCalledWith("metro-tower");
  });

  it("renders the 404 page for a missing project", async () => {
    getProject.mockRejectedValue(new ApiRequestError("gone", "NOT_FOUND", {}, 404));
    renderDetail("ghost");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
