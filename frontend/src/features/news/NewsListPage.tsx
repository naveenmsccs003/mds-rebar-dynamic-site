import type { Filter } from "../../components/FilterBar/FilterBar";
import { ArticleListTemplate } from "../articles/ArticleListTemplate";
import { useListParams } from "../shared/useListParams";
import { useNewsList } from "./hooks";

export function NewsListPage() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = useNewsList(page > 1 ? { ...filterParams, page: String(page) } : filterParams);

  const filters: Filter[] = [
    {
      kind: "text",
      name: "q",
      label: "Search",
      value: get("q"),
      placeholder: "Search news…",
      onChange: (v) => setParam("q", v),
    },
    {
      kind: "text",
      name: "year",
      label: "Year",
      value: get("year"),
      placeholder: "e.g. 2026",
      onChange: (v) => setParam("year", v.replace(/\D/g, "")),
    },
  ];

  return (
    <ArticleListTemplate
      query={query}
      basePath="/news"
      title="News"
      description="Announcements and updates from MDS Rebar."
      canonicalPath="/news"
      page={page}
      onPageChange={setPage}
      filters={filters}
    />
  );
}
