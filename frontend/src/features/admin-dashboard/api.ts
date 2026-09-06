import type { Paginated } from "../../api/envelope";
import { apiGet } from "../../api/request";

/** Just the `count` off a paginated admin list — cheap "how many pending". */
export async function countOf(path: string, params: Record<string, string> = {}): Promise<number> {
  const page = await apiGet<Paginated<unknown>>(path, { ...params, page_size: "1" });
  return page.count;
}
