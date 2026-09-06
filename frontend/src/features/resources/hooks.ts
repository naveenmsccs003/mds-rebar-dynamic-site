import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import { getResources } from "./api";
import type { ResourceListItem } from "./types";

export function useResources(params: Record<string, string>) {
  return useQuery<Paginated<ResourceListItem>>({
    queryKey: ["resources", "list", params],
    queryFn: () => getResources(params),
    placeholderData: keepPreviousData,
  });
}
