import type { Paginated } from "../../api/envelope";
import { apiGet } from "../../api/request";
import type { ServiceDetail, ServiceListItem } from "./types";

export interface ServiceListParams {
  technology?: string;
  q?: string;
}

export async function getServices(params: ServiceListParams = {}): Promise<ServiceListItem[]> {
  const page = await apiGet<Paginated<ServiceListItem>>("/services/", params);
  return page.results;
}

export function getService(slug: string): Promise<ServiceDetail> {
  return apiGet<ServiceDetail>(`/services/${encodeURIComponent(slug)}/`);
}
