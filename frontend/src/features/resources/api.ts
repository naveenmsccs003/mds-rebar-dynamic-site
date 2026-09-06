import type { Paginated } from "../../api/envelope";
import { apiGet } from "../../api/request";
import type { DownloadTicket, ResourceListItem } from "./types";

export function getResources(
  params: Record<string, string> = {},
): Promise<Paginated<ResourceListItem>> {
  return apiGet<Paginated<ResourceListItem>>("/resources/", params);
}

/**
 * Resolve the short-lived signed download URL for a resource's file
 * (docs/FILE_STORAGE.md). A `restricted` resource returns 403 unless the
 * viewer is signed in with a Knowledge Base account.
 */
export function getResourceDownload(slug: string): Promise<DownloadTicket> {
  return apiGet<DownloadTicket>(`/resources/${encodeURIComponent(slug)}/download/`);
}
