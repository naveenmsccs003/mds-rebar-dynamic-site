import { apiGet } from "../../api/request";
import type { PageSections } from "./types";

/** Published sections for a CMS page, ordered by `display_order`. */
export function getPage(pageKey: string): Promise<PageSections> {
  return apiGet<PageSections>(`/pages/${encodeURIComponent(pageKey)}/`);
}
