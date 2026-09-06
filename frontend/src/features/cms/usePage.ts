import { useQuery } from "@tanstack/react-query";

import { getPage } from "./api";
import type { PageSections } from "./types";

export const pageQueryKey = (pageKey: string) => ["cms", "page", pageKey] as const;

/**
 * Fetch a CMS page's published sections. Server state only — no local
 * copy, no useEffect/fetch (spec §57).
 */
export function usePage(pageKey: string) {
  return useQuery<PageSections>({
    queryKey: pageQueryKey(pageKey),
    queryFn: () => getPage(pageKey),
  });
}
