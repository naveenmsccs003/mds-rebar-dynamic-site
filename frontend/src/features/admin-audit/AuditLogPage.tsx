/**
 * Administration → Audit log (docs/SECURITY.md "Audit logging"). Newest
 * first, filtered by action / entity type / actor, paged by cursor
 * (Newer / Older). The drawer shows who did what, from where, and a
 * before/after diff. There are deliberately no write controls — the API
 * refuses every write, SuperAdmin included.
 */
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../components/Button/Button";
import { FilterBar, type Filter } from "../../components/FilterBar/FilterBar";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { AdminDataTable, type Column } from "../../components/admin/AdminDataTable";
import { DetailList } from "../../components/admin/DetailList";
import { FormDrawer } from "../../components/admin/FormDrawer";
import { AuditDiff } from "./AuditDiff";
import { cursorFrom, useAuditLog } from "./hooks";
import type { AuditRow } from "./types";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const actorLabel = (r: AuditRow) => r.actor_email ?? (r.actor == null ? "System" : `User #${r.actor}`);

const columns: Column<AuditRow>[] = [
  { key: "when", header: "When", render: (r) => fmtDateTime(r.timestamp), width: "190px" },
  { key: "actor", header: "Actor", render: actorLabel },
  { key: "action", header: "Action", render: (r) => <code>{r.action}</code> },
  { key: "entity", header: "Entity", render: (r) => `${r.entity_type} #${r.entity_id}` },
];

const FILTER_KEYS = ["action", "entity_type", "actor"] as const;

export function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const get = (k: string) => searchParams.get(k) ?? "";
  const [open, setOpen] = useState<AuditRow | undefined>(undefined);

  const params = useMemo(() => {
    const out: Record<string, string> = {};
    for (const k of [...FILTER_KEYS, "cursor"]) {
      const v = searchParams.get(k);
      if (v) out[k] = v;
    }
    return out;
  }, [searchParams]);
  const query = useAuditLog(params);

  /** Any filter change drops the cursor — it belongs to the old result set. */
  const setFilter = useCallback(
    (key: string, value: string) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete("cursor");
        return next;
      }),
    [setSearchParams],
  );
  const goTo = (cursor: string | null) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (cursor) next.set("cursor", cursor);
      else next.delete("cursor");
      return next;
    });

  const filters: Filter[] = [
    { kind: "text", name: "action", label: "Action", value: get("action"), placeholder: "e.g. user.updated", onChange: (v) => setFilter("action", v) },
    { kind: "text", name: "entity_type", label: "Entity type", value: get("entity_type"), placeholder: "e.g. users.User", onChange: (v) => setFilter("entity_type", v) },
    { kind: "text", name: "actor", label: "Actor (user id)", value: get("actor"), onChange: (v) => setFilter("actor", v) },
  ];

  const newer = cursorFrom(query.data?.previous ?? null);
  const older = cursorFrom(query.data?.next ?? null);

  return (
    <>
      <SEOHead title="Audit log" noindex />
      <h1>Audit log</h1>
      <p className="admin-muted">A read-only record of sign-ins, content changes and account changes, newest first.</p>
      <AdminDataTable
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpen(r)}
        emptyLabel="No audit entries match those filters."
        toolbar={<FilterBar filters={filters} />}
        pager={
          <nav aria-label="Audit log pages" className="admin-table__toolbar-row">
            <Button type="button" variant="secondary" disabled={!newer && !params.cursor} onClick={() => goTo(newer)}>
              ← Newer
            </Button>
            <Button type="button" variant="secondary" disabled={!older} onClick={() => goTo(older)}>
              Older →
            </Button>
          </nav>
        }
      />
      <FormDrawer
        open={open !== undefined}
        title={open ? `${open.action} — ${open.entity_type} #${open.entity_id}` : ""}
        onClose={() => setOpen(undefined)}
      >
        {open && (
          <div className="admin-form-stack">
            <DetailList
              rows={[
                { label: "When", value: fmtDateTime(open.timestamp) },
                { label: "Actor", value: actorLabel(open) },
                { label: "Action", value: <code>{open.action}</code> },
                { label: "Entity", value: `${open.entity_type} #${open.entity_id}` },
                { label: "IP address", value: open.ip_address },
                { label: "User agent", value: open.user_agent },
              ]}
            />
            <section className="admin-panel" aria-label="Changes">
              <h3>Changes</h3>
              <AuditDiff before={open.before} after={open.after} />
            </section>
          </div>
        )}
      </FormDrawer>
    </>
  );
}
