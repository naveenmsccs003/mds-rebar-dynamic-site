import { apiGet } from "../../api/request";
import type { SearchResponse } from "./types";

export interface SearchResult extends SearchResponse {
  count: number;
  page: number;
  num_pages: number;
  page_size: number;
}

export function getSearch(params: {
  q: string;
  type?: string;
  page?: number;
}): Promise<SearchResult> {
  const query: Record<string, string> = { q: params.q };
  if (params.type) query.type = params.type;
  if (params.page && params.page > 1) query.page = String(params.page);
  return apiGet<SearchResult>("/search/", query);
}
