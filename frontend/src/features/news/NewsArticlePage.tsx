import { useParams } from "react-router-dom";

import { ArticleDetailTemplate } from "../articles/ArticleDetailTemplate";
import { useNewsArticle } from "./hooks";

export function NewsArticlePage() {
  const { slug = "" } = useParams();
  const query = useNewsArticle(slug);
  return <ArticleDetailTemplate query={query} basePath="/news" feedLabel="News" />;
}
