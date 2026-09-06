/**
 * Shared shape for the editorial content types that extend the backend's
 * `PublishableContent` base — News now, Blogs / Events / CSR in their
 * phase. Same fields, different feed, so they share
 * `ArticleListTemplate` / `ArticleDetailTemplate`.
 */
import type { MediaRef, TechnologyRef } from "../services/types";

export interface Article {
  id: number;
  title: string;
  slug: string;
  summary: string;
  category: string;
  publish_date: string | null;
  featured_image: MediaRef | null;
  tags: TechnologyRef[];
}

export interface ArticleDetail extends Article {
  content: string;
  author_name: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  og_title: string;
  og_description: string;
  og_image: MediaRef | null;
  canonical_url: string;
  updated_at: string;
}
