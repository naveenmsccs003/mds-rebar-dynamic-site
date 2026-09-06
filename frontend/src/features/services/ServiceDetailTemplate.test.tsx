import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";

import { ApiRequestError } from "../../api/request";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { ServiceDetailTemplate } from "./ServiceDetailTemplate";
import type { ServiceDetail } from "./types";

vi.mock("./api");
const getService = vi.mocked(api.getService);

afterEach(() => vi.resetAllMocks());

function renderDetail(slug = "rebar-detailing") {
  return renderWithProviders(
    <Routes>
      <Route path="/services/:slug" element={<ServiceDetailTemplate />} />
    </Routes>,
    { route: `/services/${slug}` },
  );
}

const detail = (over: Partial<ServiceDetail> = {}): ServiceDetail => ({
  id: 1,
  name: "Rebar Detailing",
  slug: "rebar-detailing",
  short_description: "Shop drawings & BBS",
  hero_image: null,
  icon: null,
  display_order: 0,
  long_description: "<p>Full <strong>overview</strong></p>",
  og_image: null,
  business_value: "Fewer RFIs.\n\nFaster site starts.",
  standards_codes: "ACI 318; BS 8666",
  deliverables: "Placing drawings, BBS",
  output_formats: "DWG, PDF",
  technology: [{ id: 1, name: "Tekla", slug: "tekla" }],
  capabilities: [{ id: 1, title: "Bar bending schedules", description: "", display_order: 1 }],
  process_steps: [
    { id: 1, title: "Model review", description: "Check inputs", step_number: 1 },
  ],
  faqs: [{ id: 1, question: "Turnaround?", answer: "48 hours", display_order: 1 }],
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

describe("ServiceDetailTemplate", () => {
  it("renders the full template from the service record", async () => {
    getService.mockResolvedValue(detail());
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Rebar Detailing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Capabilities" })).toBeInTheDocument();
    expect(screen.getByText("Bar bending schedules")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Our process" })).toBeInTheDocument();
    expect(screen.getByText("Model review")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Business value" })).toBeInTheDocument();
    expect(screen.getByText("Fewer RFIs.")).toBeInTheDocument();
    expect(screen.getByText("Tekla")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FAQs" })).toBeInTheDocument();
    expect(screen.getByText("48 hours")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a Quote" })).toHaveAttribute(
      "href",
      "/request-quote",
    );
    expect(getService).toHaveBeenCalledWith("rebar-detailing");
  });

  it("omits sections the service has no data for", async () => {
    getService.mockResolvedValue(
      detail({ capabilities: [], process_steps: [], faqs: [], technology: [], business_value: "" }),
    );
    renderDetail();

    await screen.findByRole("heading", { level: 1, name: "Rebar Detailing" });
    expect(screen.queryByRole("heading", { name: "Capabilities" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Our process" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Business value" })).not.toBeInTheDocument();
  });

  it("renders the 404 page when the service does not exist", async () => {
    getService.mockRejectedValue(new ApiRequestError("Not found", "NOT_FOUND", {}, 404));
    renderDetail("ghost");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("shows a retryable error for a non-404 failure", async () => {
    getService.mockRejectedValue(new ApiRequestError("Server error", "INTERNAL_ERROR", {}, 500));
    renderDetail();
    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
  });

  it("shows a loading state first", () => {
    getService.mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
