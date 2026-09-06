import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders";
import * as cmsApi from "../cms/api";
import { HomePage } from "./HomePage";

vi.mock("../cms/api");
const getPage = vi.mocked(cmsApi.getPage);

afterEach(() => vi.resetAllMocks());

describe("HomePage", () => {
  it("renders CMS sections and sets the homepage <title>", async () => {
    getPage.mockResolvedValue([
      { section_key: "hero", display_order: 1, published_at: null, content: { heading: "MDS Rebar", subheading: "Engineering precision" } },
      { section_key: "prose", display_order: 2, published_at: null, content: { heading: "What we do", body_html: "<p>Rebar detailing</p>" } },
    ]);

    renderWithProviders(<HomePage />);

    expect(await screen.findByRole("heading", { level: 1, name: "MDS Rebar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What we do" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("MDS Rebar"));
    expect(getPage).toHaveBeenCalledWith("home");
  });

  it("shows a loading state first", () => {
    getPage.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<HomePage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", async () => {
    getPage.mockRejectedValue(new Error("Service unavailable"));
    renderWithProviders(<HomePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the placeholder empty state when the page has no sections", async () => {
    getPage.mockResolvedValue([]);
    renderWithProviders(<HomePage />);
    expect(await screen.findByText(/hasn't been published yet/i)).toBeInTheDocument();
  });
});
