import { useQuery } from "@tanstack/react-query";

import { getService, getServices, type ServiceListParams } from "./api";
import type { ServiceDetail, ServiceListItem } from "./types";

export const serviceKeys = {
  list: (params: ServiceListParams) => ["services", "list", params] as const,
  detail: (slug: string) => ["services", "detail", slug] as const,
};

export function useServices(params: ServiceListParams = {}) {
  return useQuery<ServiceListItem[]>({
    queryKey: serviceKeys.list(params),
    queryFn: () => getServices(params),
  });
}

export function useService(slug: string) {
  return useQuery<ServiceDetail>({
    queryKey: serviceKeys.detail(slug),
    queryFn: () => getService(slug),
  });
}
