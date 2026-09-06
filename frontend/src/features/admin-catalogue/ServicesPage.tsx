import type { Column } from "../../components/admin/AdminDataTable";
import { Area, Text } from "./formHelpers";
import { csvToList, listToCsv, numOrNull } from "./formUtils";
import { WorkflowResourcePage } from "./WorkflowResourcePage";
import { services as hooks } from "./hooks";
import type { ServiceRow } from "./types";

const columns: Column<ServiceRow>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "slug", header: "Slug", render: (r) => r.slug },
  { key: "order", header: "Order", render: (r) => r.display_order, width: "80px" },
  {
    key: "status",
    header: "Status",
    render: (r) => <span className={`status-pill status-pill--${r.status}`}>{r.status}</span>,
  },
];

export function ServicesPage() {
  return (
    <WorkflowResourcePage<ServiceRow>
      title="Services"
      permBase="services.service"
      hooks={hooks}
      columns={columns}
      initial={(row) => ({
        name: row?.name ?? "",
        slug: row?.slug ?? "",
        short_description: row?.short_description ?? "",
        long_description: row?.long_description ?? "",
        business_value: row?.business_value ?? "",
        deliverables: row?.deliverables ?? "",
        display_order: row?.display_order ?? 0,
        hero_image: row?.hero_image ?? "",
        technology: listToCsv(row?.technology),
        seo_title: row?.seo_title ?? "",
        seo_description: row?.seo_description ?? "",
      })}
      build={(v) => ({
        name: v.name,
        slug: v.slug,
        short_description: v.short_description,
        long_description: v.long_description,
        business_value: v.business_value,
        deliverables: v.deliverables,
        display_order: numOrNull(v.display_order) ?? 0,
        hero_image: numOrNull(v.hero_image),
        technology: csvToList(v.technology),
        seo_title: v.seo_title,
        seo_description: v.seo_description,
      })}
      renderFields={(v, set, e) => (
        <>
          <Text name="name" label="Name" values={v} set={set} errors={e} />
          <Text name="slug" label="Slug" values={v} set={set} errors={e} />
          <Text name="display_order" label="Display order" type="number" values={v} set={set} errors={e} />
          <Area name="short_description" label="Short description" rows={2} values={v} set={set} errors={e} />
          <Area
            name="long_description"
            label="Long description (HTML — sanitised on save)"
            rows={6}
            values={v}
            set={set}
            errors={e}
          />
          <Area name="business_value" label="Business value" rows={3} values={v} set={set} errors={e} />
          <Area name="deliverables" label="Deliverables" rows={3} values={v} set={set} errors={e} />
          <Text
            name="technology"
            label="Technology (comma-separated slugs)"
            values={v}
            set={set}
            errors={e}
          />
          <Text
            name="hero_image"
            label="Hero image — media asset id (media picker in A5)"
            type="number"
            values={v}
            set={set}
            errors={e}
          />
          <Text name="seo_title" label="SEO title" values={v} set={set} errors={e} />
          <Text name="seo_description" label="SEO description" values={v} set={set} errors={e} />
        </>
      )}
    />
  );
}
