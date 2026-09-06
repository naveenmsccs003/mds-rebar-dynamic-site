/**
 * A read-only `<dl>` of label/value pairs for the admin detail drawers
 * (Inbox — everything the public submitter sent is immutable through the
 * API). Rows whose value is empty/nullish are dropped unless
 * `keepEmpty` is set.
 */
import type { ReactNode } from "react";

export interface DetailRow {
  label: string;
  value: ReactNode;
  keepEmpty?: boolean;
}

function isEmpty(value: ReactNode): boolean {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function DetailList({ rows }: { rows: DetailRow[] }) {
  const shown = rows.filter((r) => r.keepEmpty || !isEmpty(r.value));
  if (shown.length === 0) return null;
  return (
    <dl className="admin-detail">
      {shown.map((r) => (
        <div key={r.label} className="admin-detail__row">
          <dt>{r.label}</dt>
          <dd>{isEmpty(r.value) ? "—" : r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
