/**
 * Inbox → Applications. Job applications are HR-only (they only ever
 * arrive through the public careers form). The drawer shows the
 * submission, a short-lived signed résumé link on request (logged +
 * refused while the file is still being scanned), a flat status/assignee
 * form, and — with `applications.delete_jobapplication` — a delete
 * (docs/API_DESIGN.md §16).
 */
import { useState } from "react";

import { ApiRequestError } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { DetailList } from "../../components/admin/DetailList";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { useListParams } from "../shared/useListParams";
import { usePermission } from "../auth/usePermission";
import { applications as hooks, useDeleteApplication, useResumeUrl } from "./hooks";
import type { ApplicationRow, ApplicationStatus } from "./types";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
  hired: "Hired",
};
const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}));

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

const columns: Column<ApplicationRow>[] = [
  { key: "name", header: "Applicant", render: (r) => r.name },
  { key: "job", header: "Role", render: (r) => r.job_title },
  {
    key: "status",
    header: "Status",
    render: (r) => <span className={`status-pill status-pill--${r.status}`}>{STATUS_LABELS[r.status]}</span>,
  },
  { key: "assignee", header: "Owner", render: (r) => r.assigned_to_email || "—" },
  { key: "created", header: "Received", render: (r) => fmtDate(r.created_at), width: "120px" },
];

function ResumeLink({ application }: { application: ApplicationRow }) {
  const resume = useResumeUrl();
  if (!application.resume) return <p className="admin-muted">No résumé on file.</p>;
  if (resume.data) {
    return (
      <p>
        <a href={resume.data.url} target="_blank" rel="noreferrer">
          Download {application.resume_filename || "résumé"}
        </a>{" "}
        <span className="admin-muted">— link expires shortly</span>
      </p>
    );
  }
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={resume.isPending}
        onClick={() => resume.mutate(application.id)}
      >
        {resume.isPending ? "Preparing…" : "Get résumé link"}
      </Button>
      {resume.error instanceof ApiRequestError && (
        <p className="form__error" role="alert">
          {resume.error.message}
        </p>
      )}
    </>
  );
}

function StatusForm({ application, onDone }: { application: ApplicationRow; onDone: () => void }) {
  const update = hooks.useUpdate();
  const canChange = usePermission("applications.change_jobapplication");
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [assignee, setAssignee] = useState(
    application.assigned_to == null ? "" : String(application.assigned_to),
  );

  const parsed = assignee.trim() === "" ? null : Number(assignee);
  const invalid = assignee.trim() !== "" && !Number.isInteger(parsed);
  const dirty = status !== application.status || parsed !== application.assigned_to;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || invalid) return;
    update.mutate(
      { id: application.id, body: { status, assigned_to: parsed } },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="form__field">
        <span>Status</span>
        <select
          value={status}
          disabled={!canChange}
          onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="form__field">
        <span>Assigned to (user id)</span>
        <input
          type="number"
          inputMode="numeric"
          value={assignee}
          disabled={!canChange}
          aria-invalid={invalid || undefined}
          onChange={(e) => setAssignee(e.target.value)}
        />
        <span className="admin-muted">
          {application.assigned_to_email ? `Currently ${application.assigned_to_email}` : "Currently unassigned"}
        </span>
        {invalid && <span className="form__error">Enter a whole number, or leave blank.</span>}
      </label>
      {!canChange && (
        <p className="admin-muted">Requires applications.change_jobapplication.</p>
      )}
      {update.error instanceof ApiRequestError && (
        <p className="form__error" role="alert">
          {update.error.message}
        </p>
      )}
      <Button type="submit" disabled={!canChange || !dirty || invalid || update.isPending}>
        {update.isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function Drawer({ row, onClose }: { row: ApplicationRow; onClose: () => void }) {
  const detail = hooks.useDetail(row.id);
  const a = detail.data ?? row;
  const canDelete = usePermission("applications.delete_jobapplication");
  const remove = useDeleteApplication();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="admin-form-stack">
      <DetailList
        rows={[
          { label: "Applicant", value: a.name },
          { label: "Email", value: <a href={`mailto:${a.email}`}>{a.email}</a> },
          { label: "Phone", value: a.phone },
          { label: "Role", value: `${a.job_title} (${a.job_slug})` },
          { label: "Cover letter", value: a.cover_letter },
          { label: "Additional info", value: a.additional_info },
          { label: "Résumé status", value: a.resume_status || "—", keepEmpty: true },
        ]}
      />
      <section className="admin-panel" aria-label="Résumé">
        <h3>Résumé</h3>
        <ResumeLink application={a} />
      </section>
      <section className="admin-panel" aria-label="Status and assignment">
        <h3>Status & assignment</h3>
        <StatusForm application={a} onDone={onClose} />
      </section>
      {canDelete && (
        <section className="admin-panel" aria-label="Danger zone">
          <h3>Delete</h3>
          <p className="admin-muted">
            Permanently removes this application and its résumé reference. This can’t be undone.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="button--danger"
            onClick={() => setConfirming(true)}
          >
            Delete application
          </Button>
        </section>
      )}
      <ConfirmDialog
        open={confirming}
        title="Delete this application?"
        body={`${a.name} — ${a.job_title}. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => remove.mutate(a.id, { onSuccess: onClose })}
      />
    </div>
  );
}

export function ApplicationsPage() {
  const { get, page, setParam, setPage, filterParams } = useListParams();
  const query = hooks.useList(page > 1 ? { ...filterParams, page: String(page) } : filterParams);
  const [open, setOpen] = useState<ApplicationRow | undefined>(undefined);

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
      name: "job",
      label: "Job posting id",
      value: get("job"),
      onChange: (v) => setParam("job", v),
    },
  ];

  return (
    <>
      <SEOHead title="Applications" noindex />
      <h1>Applications</h1>
      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpen(r)}
        page={page}
        onPageChange={setPage}
        emptyLabel="No applications match those filters."
        toolbar={<FilterBar filters={filters} />}
      />
      <FormDrawer
        open={open !== undefined}
        title={open ? `${open.name} — ${open.job_title}` : ""}
        onClose={() => setOpen(undefined)}
      >
        {open && <Drawer row={open} onClose={() => setOpen(undefined)} />}
      </FormDrawer>
    </>
  );
}
