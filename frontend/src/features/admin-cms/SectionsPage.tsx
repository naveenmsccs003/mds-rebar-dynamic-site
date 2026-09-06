import { useState } from "react";

import { Button } from "../../components/Button/Button";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { useListParams } from "../shared/useListParams";
import { usePermission } from "../auth/usePermission";
import { SectionForm } from "./SectionForm";
import { useSections } from "./hooks";
import type { PageSectionRow } from "./types";

const STATUS_OPTIONS = ["draft", "review", "approved", "published", "archived"].map((s) => ({
  value: s,
  label: s,
}));

const columns: Column<PageSectionRow>[] = [
  { key: "page_key", header: "Page", render: (r) => r.page_key },
  { key: "section_key", header: "Section", render: (r) => r.section_key },
  { key: "order", header: "Order", render: (r) => r.display_order, width: "80px" },
  {
    key: "status",
    header: "Status",
    render: (r) => <span className={`status-pill status-pill--${r.status}`}>{r.status}</span>,
  },
  { key: "updated", header: "Updated by", render: (r) => r.updated_by_email || "—" },
];

export function SectionsPage() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = useSections(page > 1 ? { ...filterParams, page: String(page) } : filterParams);
  const canAdd = usePermission("pages.add_pagesection");

  const [editing, setEditing] = useState<PageSectionRow | null | undefined>(undefined);
  // undefined = closed, null = create, row = edit

  const filters: Filter[] = [
    {
      kind: "text",
      name: "page_key",
      label: "Page key",
      value: get("page_key"),
      onChange: (v) => setParam("page_key", v),
    },
    {
      kind: "select",
      name: "status",
      label: "Status",
      value: get("status"),
      options: STATUS_OPTIONS,
      onChange: (v) => setParam("status", v),
    },
  ];

  return (
    <>
      <SEOHead title="CMS sections" noindex />
      <h1>CMS sections</h1>

      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setEditing(r)}
        page={page}
        onPageChange={setPage}
        emptyLabel="No sections match those filters."
        toolbar={
          <div className="admin-table__toolbar-row">
            <FilterBar filters={filters} />
            {canAdd && (
              <Button type="button" onClick={() => setEditing(null)}>
                New section
              </Button>
            )}
          </div>
        }
      />

      <FormDrawer
        open={editing !== undefined}
        title={editing ? `Edit ${editing.page_key}/${editing.section_key}` : "New section"}
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <SectionForm section={editing} onSaved={() => setEditing(undefined)} />
        )}
      </FormDrawer>
    </>
  );
}
