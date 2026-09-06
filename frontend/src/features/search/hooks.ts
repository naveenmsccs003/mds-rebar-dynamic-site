import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getSearch, type SearchResult } from "./api";

export function useSearch(q: string, opts: { type?: string; page?: number } = {}) {
  const enabled = q.trim().length >= 2;
  return useQuery<SearchResult>({
    queryKey: ["search", q, opts.type ?? "", opts.page ?? 1],
    queryFn: () => getSearch({ q, type: opts.type, page: opts.page }),
    enabled,
    placeholderData: keepPreviousData,
  });
}
