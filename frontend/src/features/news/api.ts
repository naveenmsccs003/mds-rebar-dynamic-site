import type { Paginated } from "../../api/envelope";
import { apiGet } from "../../api/request";
import type { Article, ArticleDetail } from "../articles/types";

export function getNewsList(params: Record<string, string> = {}): Promise<Paginated<Article>> {
  return apiGet<Paginated<Article>>("/news/", params);
}

export function getNewsArticle(slug: string): Promise<ArticleDetail> {
  return apiGet<ArticleDetail>(`/news/${encodeURIComponent(slug)}/`);
}
