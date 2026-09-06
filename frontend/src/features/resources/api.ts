import type { Paginated } from "../../api/envelope";
import { apiGet } from "../../api/request";
import type { ResourceListItem } from "./types";

export function getResources(
  params: Record<string, string> = {},
): Promise<Paginated<ResourceListItem>> {
  return apiGet<Paginated<ResourceListItem>>("/resources/", params);
}
