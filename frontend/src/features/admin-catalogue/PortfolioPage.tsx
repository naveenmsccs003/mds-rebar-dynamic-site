import type { Column } from "../../components/admin/AdminDataTable";
import { Area, Bool, Text } from "./formHelpers";
import { csvToList, listToCsv, numOrNull } from "./formUtils";
import { WorkflowResourcePage } from "./WorkflowResourcePage";
import { portfolio as hooks } from "./hooks";
import type { ProjectRow } from "./types";

const columns: Column<ProjectRow>[] = [
  { key: "title", header: "Title", render: (r) => r.title },
  { key: "category", header: "Category", render: (r) => r.category },
  { key: "year", header: "Year", render: (r) => r.completion_year ?? "—", width: "80px" },
  {
    key: "status",
    header: "Status",
    render: (r) => <span className={`status-pill status-pill--${r.status}`}>{r.status}</span>,
  },
];

export function PortfolioPage() {
  return (
    <WorkflowResourcePage<ProjectRow>
      title="Portfolio"
      permBase="portfolio.project"
      hooks={hooks}
      columns={columns}
      initial={(row) => ({
        title: row?.title ?? "",
        slug: row?.slug ?? "",
        category: row?.category ?? "",
        description: row?.description ?? "",
        completion_year: row?.completion_year ?? "",
        is_featured: row?.is_featured ?? false,
        services: listToCsv(row?.services),
        technology: listToCsv(row?.technology),
        seo_title: row?.seo_title ?? "",
        seo_description: row?.seo_description ?? "",
      })}
      build={(v) => ({
        title: v.title,
        slug: v.slug,
        category: v.category,
        description: v.description,
        completion_year: numOrNull(v.completion_year),
        is_featured: !!v.is_featured,
        services: csvToList(v.services),
        technology: csvToList(v.technology),
        seo_title: v.seo_title,
        seo_description: v.seo_description,
      })}
      renderFields={(v, set, e) => (
        <>
          <Text name="title" label="Title" values={v} set={set} errors={e} />
          <Text name="slug" label="Slug" values={v} set={set} errors={e} />
          <Text name="category" label="Category" values={v} set={set} errors={e} />
          <Text name="completion_year" label="Completion year" type="number" values={v} set={set} errors={e} />
          <Bool name="is_featured" label="Featured" values={v} set={set} />
          <Area
            name="description"
            label="Description (HTML — sanitised on save)"
            rows={6}
            values={v}
            set={set}
            errors={e}
          />
          <Text name="services" label="Services (comma-separated slugs)" values={v} set={set} errors={e} />
          <Text name="technology" label="Technology (comma-separated slugs)" values={v} set={set} errors={e} />
          <Text name="seo_title" label="SEO title" values={v} set={set} errors={e} />
          <Text name="seo_description" label="SEO description" values={v} set={set} errors={e} />
        </>
      )}
    />
  );
}
