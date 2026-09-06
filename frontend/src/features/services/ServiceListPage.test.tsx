import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { ServiceListPage } from "./ServiceListPage";
import type { ServiceListItem } from "./types";

vi.mock("./api");
const getServices = vi.mocked(api.getServices);

afterEach(() => vi.resetAllMocks());

const svc = (over: Partial<ServiceListItem>): ServiceListItem => ({
  id: 1,
  name: "Rebar Detailing",
  slug: "rebar-detailing",
  short_description: "Shop drawings",
  hero_image: null,
  icon: null,
  display_order: 0,
  ...over,
});

describe("ServiceListPage", () => {
  it("renders a card per service linking to its detail page", async () => {
    getServices.mockResolvedValue([
      svc({}),
      svc({ id: 2, name: "Estimation", slug: "estimation" }),
    ]);
    renderWithProviders(<ServiceListPage />);

    const detail = await screen.findByRole("link", { name: /Rebar Detailing/ });
    expect(detail).toHaveAttribute("href", "/services/rebar-detailing");
    expect(screen.getByRole("link", { name: /Estimation/ })).toHaveAttribute(
      "href",
      "/services/estimation",
    );
    await waitFor(() => expect(document.title).toBe("Services — MDS Rebar"));
  });

  it("shows the loading state, then the empty state when nothing is published", async () => {
    getServices.mockResolvedValue([]);
    renderWithProviders(<ServiceListPage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText(/No services published yet/i)).toBeInTheDocument();
  });

  it("shows an error with retry on failure", async () => {
    getServices.mockRejectedValue(new Error("down"));
    renderWithProviders(<ServiceListPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("down");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
