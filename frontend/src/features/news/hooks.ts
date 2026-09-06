import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import type { Article, ArticleDetail } from "../articles/types";
import { getNewsArticle, getNewsList } from "./api";

export function useNewsList(params: Record<string, string>) {
  return useQuery<Paginated<Article>>({
    queryKey: ["news", "list", params],
    queryFn: () => getNewsList(params),
    placeholderData: keepPreviousData,
  });
}

export function useNewsArticle(slug: string) {
  return useQuery<ArticleDetail>({
    queryKey: ["news", "detail", slug],
    queryFn: () => getNewsArticle(slug),
  });
}
