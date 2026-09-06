/**
 * Inbox → Quote requests. A server-filtered list; the drawer shows the
 * full submission (read-only) plus the lead status / assignee form
 * (docs/API_DESIGN.md §17, docs/RBAC_DESIGN.md lead lifecycle).
 */
import { useState } from "react";

import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { DetailList } from "../../components/admin/DetailList";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { useListParams } from "../shared/useListParams";
import { LeadForm } from "./LeadForm";
import { LEAD_STATUS_LABELS, QUOTE_MODEL } from "./leadLifecycle";
import { quoteRequests as hooks } from "./hooks";
import type { LeadStatus, QuoteRequestRow } from "./types";

const STATUS_OPTIONS = (Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => ({
  value: s,
  label: LEAD_STATUS_LABELS[s],
}));

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

const columns: Column<QuoteRequestRow>[] = [
  { key: "ref", header: "Reference", render: (r) => r.public_reference },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "company", header: "Company", render: (r) => r.company || "—" },
  {
    key: "status",
    header: "Status",
    render: (r) => <span className={`status-pill status-pill--${r.status}`}>{LEAD_STATUS_LABELS[r.status]}</span>,
  },
  { key: "assignee", header: "Owner", render: (r) => r.assigned_to_email || "—" },
  { key: "created", header: "Received", render: (r) => fmtDate(r.created_at), width: "120px" },
];

function Drawer({ row }: { row: QuoteRequestRow }) {
  const detail = hooks.useDetail(row.id);
  const q = detail.data ?? row;
  const update = hooks.useUpdate();

  return (
    <div className="admin-form-stack">
      <DetailList
        rows={[
          { label: "Reference", value: q.public_reference },
          { label: "Name", value: q.name },
          { label: "Company", value: q.company },
          { label: "Email", value: <a href={`mailto:${q.email}`}>{q.email}</a> },
          { label: "Phone", value: q.phone },
          { label: "Country", value: q.country_code },
          { label: "Primary service", value: q.service_slug },
          { label: "Also interested in", value: q.required_service_slugs.join(", ") },
          { label: "Project type", value: q.project_type },
          { label: "Location", value: q.project_location },
          { label: "Size", value: q.project_size },
          { label: "Timeline", value: q.timeline },
          { label: "Message", value: q.message },
          { label: "Submitted from", value: q.ip_address },
        ]}
      />
      <section className="admin-panel" aria-label="Status and assignment">
        <h3>Status & assignment</h3>
        <LeadForm
          model={QUOTE_MODEL}
          status={q.status}
          allowedTransitions={q.allowed_transitions}
          assignedTo={q.assigned_to}
          assignedToEmail={q.assigned_to_email}
          busy={update.isPending}
          error={update.error}
          onSave={(body) => update.mutate({ id: q.id, body })}
        />
      </section>
    </div>
  );
}

export function QuoteRequestsPage() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = hooks.useList(page > 1 ? { ...filterParams, page: String(page) } : filterParams);
  const [open, setOpen] = useState<QuoteRequestRow | undefined>(undefined);

  const filters: Filter[] = [
    {
      kind: "select",
      name: "status",
      label: "Status",
      value: get("status"),
      options: STATUS_OPTIONS,
      onChange: (v) => setParam("status", v),
    },
    {
      kind: "text",
      name: "assigned_to",
      label: "Owner (user id)",
      value: get("assigned_to"),
      onChange: (v) => setParam("assigned_to", v),
    },
  ];

  return (
    <>
      <SEOHead title="Quote requests" noindex />
      <h1>Quote requests</h1>
      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpen(r)}
        page={page}
        onPageChange={setPage}
        emptyLabel="No quote requests match those filters."
        toolbar={<FilterBar filters={filters} />}
      />
      <FormDrawer
        open={open !== undefined}
        title={open ? open.public_reference : ""}
        onClose={() => setOpen(undefined)}
      >
        {open && <Drawer row={open} />}
      </FormDrawer>
    </>
  );
}
