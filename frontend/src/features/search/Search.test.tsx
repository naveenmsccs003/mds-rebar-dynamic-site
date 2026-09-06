import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { SearchPage } from "./SearchPage";
import type { SearchHit } from "./types";

vi.mock("./api");
const getSearch = vi.mocked(api.getSearch);
afterEach(() => vi.resetAllMocks());

const hit = (o: Partial<SearchHit> = {}): SearchHit => ({
  type: "service",
  title: "Rebar Detailing",
  url: "/services/rebar-detailing",
  snippet: "Shop drawings and schedules.",
  score: 2,
  ...o,
});

function result(hits: SearchHit[], over: Partial<api.SearchResult> = {}): api.SearchResult {
  return {
    query: "rebar",
    results: hits,
    count: hits.length,
    page: 1,
    num_pages: 1,
    page_size: 20,
    ...over,
  };
}

describe("SearchPage", () => {
  it("prompts for input when the URL has no query", () => {
    renderWithProviders(<SearchPage />, { route: "/search" });
    expect(screen.getByText(/at least two characters/i)).toBeInTheDocument();
    expect(getSearch).not.toHaveBeenCalled();
  });

  it("runs the query from the URL and links each hit", async () => {
    getSearch.mockResolvedValue(result([hit(), hit({ type: "news", title: "Rebar news", url: "/news/x" })]));
    renderWithProviders(<SearchPage />, { route: "/search?q=rebar" });

    expect(await screen.findByRole("link", { name: "Rebar Detailing" })).toHaveAttribute(
      "href",
      "/services/rebar-detailing",
    );
    expect(screen.getByText(/2 results for/i)).toBeInTheDocument();
    expect(getSearch).toHaveBeenCalledWith({ q: "rebar", type: undefined, page: 1 });
  });

  it("submitting the form puts the query in the URL", async () => {
    getSearch.mockResolvedValue(result([hit()]));
    renderWithProviders(<SearchPage />, { route: "/search" });
    const user = userEvent.setup();

    await user.type(screen.getByRole("searchbox"), "rebar");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(getSearch).toHaveBeenCalledWith({ q: "rebar", type: undefined, page: 1 }));
  });

  it("shows the empty state when nothing matches", async () => {
    getSearch.mockResolvedValue(result([], { count: 0 }));
    renderWithProviders(<SearchPage />, { route: "/search?q=zzzz" });
    expect(await screen.findByText(/Nothing matched/i)).toBeInTheDocument();
  });

  it("is marked noindex", async () => {
    renderWithProviders(<SearchPage />, { route: "/search?q=rebar" });
    getSearch.mockResolvedValue(result([hit()]));
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow"),
    );
  });
});
