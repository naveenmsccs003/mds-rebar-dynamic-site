import type { Column } from "../../components/admin/AdminDataTable";
import { Area, Text } from "./formHelpers";
import { csvToList, listToCsv, numOrNull } from "./formUtils";
import { WorkflowResourcePage } from "./WorkflowResourcePage";
import { news as hooks } from "./hooks";
import type { NewsRow } from "./types";

const columns: Column<NewsRow>[] = [
  { key: "title", header: "Title", render: (r) => r.title },
  { key: "category", header: "Category", render: (r) => r.category },
  { key: "date", header: "Publish date", render: (r) => r.publish_date?.slice(0, 10) ?? "—" },
  {
    key: "status",
    header: "Status",
    render: (r) => <span className={`status-pill status-pill--${r.status}`}>{r.status}</span>,
  },
];

export function NewsPage() {
  return (
    <WorkflowResourcePage<NewsRow>
      title="News"
      permBase="news.news"
      hooks={hooks}
      columns={columns}
      initial={(row) => ({
        title: row?.title ?? "",
        slug: row?.slug ?? "",
        summary: row?.summary ?? "",
        content: row?.content ?? "",
        category: row?.category ?? "",
        tags: listToCsv(row?.tags),
        publish_date: row?.publish_date?.slice(0, 16) ?? "",
        seo_title: row?.seo_title ?? "",
        seo_description: row?.seo_description ?? "",
      })}
      build={(v) => ({
        title: v.title,
        slug: v.slug,
        summary: v.summary,
        content: v.content,
        category: v.category,
        tags: csvToList(v.tags).map((s) => numOrNull(s)).filter((n): n is number => n !== null),
        publish_date: v.publish_date ? String(v.publish_date) : null,
        seo_title: v.seo_title,
        seo_description: v.seo_description,
      })}
      renderFields={(v, set, e) => (
        <>
          <Text name="title" label="Title" values={v} set={set} errors={e} />
          <Text name="slug" label="Slug" values={v} set={set} errors={e} />
          <Text name="category" label="Category" values={v} set={set} errors={e} />
          <Text name="publish_date" label="Publish date/time" type="datetime-local" values={v} set={set} errors={e} />
          <Area name="summary" label="Summary" rows={2} values={v} set={set} errors={e} />
          <Area
            name="content"
            label="Content (HTML — sanitised on save)"
            rows={8}
            values={v}
            set={set}
            errors={e}
          />
          <Text name="tags" label="Tag ids (comma-separated)" values={v} set={set} errors={e} />
          <Text name="seo_title" label="SEO title" values={v} set={set} errors={e} />
          <Text name="seo_description" label="SEO description" values={v} set={set} errors={e} />
        </>
      )}
    />
  );
}
