import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";

import type { Paginated } from "../../api/envelope";
import { ApiRequestError } from "../../api/request";
import type { Article, ArticleDetail } from "../articles/types";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "./api";
import { NewsArticlePage } from "./NewsArticlePage";
import { NewsListPage } from "./NewsListPage";

vi.mock("./api");
const getNewsList = vi.mocked(api.getNewsList);
const getNewsArticle = vi.mocked(api.getNewsArticle);
afterEach(() => vi.resetAllMocks());

const article = (o: Partial<Article>): Article => ({
  id: 1,
  title: "New Dubai office",
  slug: "new-dubai-office",
  summary: "We have opened a new office.",
  category: "Company",
  publish_date: "2026-02-01T00:00:00Z",
  featured_image: null,
  tags: [],
  ...o,
});

describe("NewsListPage", () => {
  it("renders the feed with dated cards linking under /news", async () => {
    getNewsList.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [article({})],
    } satisfies Paginated<Article>);

    renderWithProviders(<NewsListPage />, { route: "/news" });

    expect(await screen.findByRole("link", { name: /New Dubai office/ })).toHaveAttribute(
      "href",
      "/news/new-dubai-office",
    );
    await waitFor(() => expect(document.title).toBe("News — MDS Rebar"));
  });

  it("shows the empty state for an empty feed", async () => {
    getNewsList.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    renderWithProviders(<NewsListPage />, { route: "/news" });
    expect(await screen.findByText(/No news published yet/i)).toBeInTheDocument();
  });
});

describe("NewsArticlePage", () => {
  function renderArticle(slug: string) {
    return renderWithProviders(
      <Routes>
        <Route path="/news/:slug" element={<NewsArticlePage />} />
      </Routes>,
      { route: `/news/${slug}` },
    );
  }

  it("renders the article body, byline and tags", async () => {
    const detail: ArticleDetail = {
      ...article({}),
      content: "<p>Full <strong>story</strong>.</p>",
      author_name: "Sam Lee",
      seo_title: "",
      seo_description: "",
      seo_keywords: "",
      og_title: "",
      og_description: "",
      og_image: null,
      canonical_url: "",
      updated_at: "2026-02-01T00:00:00Z",
      tags: [{ id: 1, name: "Expansion", slug: "expansion" }],
    };
    getNewsArticle.mockResolvedValue(detail);
    renderArticle("new-dubai-office");

    expect(await screen.findByRole("heading", { level: 1, name: "New Dubai office" })).toBeInTheDocument();
    expect(screen.getByText("story")).toBeInTheDocument();
    expect(screen.getByText(/Sam Lee/)).toBeInTheDocument();
    expect(screen.getByText("Expansion")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Back to News" })).toHaveAttribute("href", "/news");
  });

  it("renders the 404 page for a missing article", async () => {
    getNewsArticle.mockRejectedValue(new ApiRequestError("gone", "NOT_FOUND", {}, 404));
    renderArticle("ghost");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
