/** `GET /api/v1/search/` (docs/API_DESIGN.md — Phase 11). */
export type SearchType = "service" | "project" | "news" | "resource" | "job";

export interface SearchHit {
  type: SearchType;
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchHit[];
}

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  service: "Service",
  project: "Project",
  news: "News",
  resource: "Resource",
  job: "Career",
};
