/**
 * Inbox → Enquiries. Like the quote-request screen plus the append-only
 * internal note thread (docs/API_DESIGN.md §18).
 */
import { useState } from "react";

import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { DetailList } from "../../components/admin/DetailList";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { useListParams } from "../shared/useListParams";
import { LeadForm } from "./LeadForm";
import { ENQUIRY_MODEL, LEAD_STATUS_LABELS } from "./leadLifecycle";
import { NotesThread } from "./NotesThread";
import { enquiries as hooks } from "./hooks";
import type { EnquiryRow, LeadStatus } from "./types";

const STATUS_OPTIONS = (Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => ({
  value: s,
  label: LEAD_STATUS_LABELS[s],
}));

const TYPE_OPTIONS = [
  { value: "contact", label: "Contact" },
  { value: "business", label: "Business enquiry" },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

const columns: Column<EnquiryRow>[] = [
  { key: "ref", header: "Reference", render: (r) => r.public_reference },
  { key: "name", header: "Name", render: (r) => r.name },
  { key: "type", header: "Type", render: (r) => (r.enquiry_type === "business" ? "Business" : "Contact") },
  {
    key: "status",
    header: "Status",
    render: (r) => <span className={`status-pill status-pill--${r.status}`}>{LEAD_STATUS_LABELS[r.status]}</span>,
  },
  { key: "assignee", header: "Owner", render: (r) => r.assigned_to_email || "—" },
  { key: "created", header: "Received", render: (r) => fmtDate(r.created_at), width: "120px" },
];

function Drawer({ row }: { row: EnquiryRow }) {
  const detail = hooks.useDetail(row.id);
  const q = detail.data ?? row;
  const update = hooks.useUpdate();

  return (
    <div className="admin-form-stack">
      <DetailList
        rows={[
          { label: "Reference", value: q.public_reference },
          { label: "Type", value: q.enquiry_type === "business" ? "Business enquiry" : "Contact" },
          { label: "Name", value: q.name },
          { label: "Company", value: q.company },
          { label: "Email", value: <a href={`mailto:${q.email}`}>{q.email}</a> },
          { label: "Phone", value: q.phone },
          { label: "Message", value: q.message },
          { label: "Submitted from", value: q.ip_address },
        ]}
      />
      <section className="admin-panel" aria-label="Status and assignment">
        <h3>Status & assignment</h3>
        <LeadForm
          model={ENQUIRY_MODEL}
          status={q.status}
          allowedTransitions={q.allowed_transitions}
          assignedTo={q.assigned_to}
          assignedToEmail={q.assigned_to_email}
          busy={update.isPending}
          error={update.error}
          onSave={(body) => update.mutate({ id: q.id, body })}
        />
      </section>
      <section className="admin-panel" aria-label="Internal notes">
        <h3>Internal notes</h3>
        <NotesThread enquiryId={q.id} notes={q.notes} />
      </section>
    </div>
  );
}

export function EnquiriesPage() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = hooks.useList(page > 1 ? { ...filterParams, page: String(page) } : filterParams);
  const [open, setOpen] = useState<EnquiryRow | undefined>(undefined);

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
      kind: "select",
      name: "enquiry_type",
      label: "Type",
      value: get("enquiry_type"),
      options: TYPE_OPTIONS,
      onChange: (v) => setParam("enquiry_type", v),
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
      <SEOHead title="Enquiries" noindex />
      <h1>Enquiries</h1>
      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpen(r)}
        page={page}
        onPageChange={setPage}
        emptyLabel="No enquiries match those filters."
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
