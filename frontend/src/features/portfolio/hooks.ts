import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import { getProject, getProjects } from "./api";
import type { ProjectDetail, ProjectListItem } from "./types";

export const portfolioKeys = {
  list: (params: Record<string, string | number>) => ["portfolio", "list", params] as const,
  detail: (slug: string) => ["portfolio", "detail", slug] as const,
};

export function useProjects(params: Record<string, string | number>) {
  return useQuery<Paginated<ProjectListItem>>({
    queryKey: portfolioKeys.list(params),
    queryFn: () => getProjects(params),
    placeholderData: keepPreviousData, // keep the old page visible while the next loads
  });
}

export function useProject(slug: string) {
  return useQuery<ProjectDetail>({
    queryKey: portfolioKeys.detail(slug),
    queryFn: () => getProject(slug),
  });
}
