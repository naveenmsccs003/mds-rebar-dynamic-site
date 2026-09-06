import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import { getResourceDownload, getResources } from "./api";
import type { DownloadTicket, ResourceListItem } from "./types";

export function useResources(params: Record<string, string>) {
  return useQuery<Paginated<ResourceListItem>>({
    queryKey: ["resources", "list", params],
    queryFn: () => getResources(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * On success, hands back the signed URL for the caller to navigate to.
 * Keyed by slug so several cards on the page track their own state.
 */
export function useResourceDownload() {
  return useMutation<DownloadTicket, unknown, string>({
    mutationFn: (slug: string) => getResourceDownload(slug),
  });
}
