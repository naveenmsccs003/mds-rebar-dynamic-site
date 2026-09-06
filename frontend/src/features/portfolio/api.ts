import type { Paginated } from "../../api/envelope";
import { apiGet } from "../../api/request";
import type { ProjectDetail, ProjectListItem } from "./types";

export function getProjects(
  params: Record<string, string | number> = {},
): Promise<Paginated<ProjectListItem>> {
  return apiGet<Paginated<ProjectListItem>>("/portfolio/", params);
}

export function getProject(slug: string): Promise<ProjectDetail> {
  return apiGet<ProjectDetail>(`/portfolio/${encodeURIComponent(slug)}/`);
}
