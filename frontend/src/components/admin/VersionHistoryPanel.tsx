/**
 * `ContentVersion` history for a workflow-managed record
 * (docs/API_DESIGN.md — `GET …/{id}/versions/` + `…/versions/{v}/rollback/`).
 * Rollback is itself versioned server-side.
 */
import type { UseQueryResult } from "@tanstack/react-query";

import type { Paginated } from "../../api/envelope";
import type { ContentVersion } from "../../features/admin-shared/crud";
import { Button } from "../Button/Button";
import { Skeleton } from "../Skeleton/Skeleton";

export interface VersionHistoryPanelProps {
  query: UseQueryResult<Paginated<ContentVersion>>;
  canRollback: boolean;
  rollingBackId: number | null;
  onRollback: (versionId: number) => void;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function VersionHistoryPanel({
  query,
  canRollback,
  rollingBackId,
  onRollback,
}: VersionHistoryPanelProps) {
  if (query.isPending) return <Skeleton lines={4} />;
  if (query.isError) return <p className="form__error">Couldn’t load history.</p>;
  if (query.data.results.length === 0) return <p className="admin-muted">No prior versions.</p>;

  return (
    <ul className="version-history">
      {query.data.results.map((v) => (
        <li key={v.id} className="version-history__item">
          <div>
            <p className="version-history__meta">
              {when(v.edited_at)} · {v.edited_by_email || "system"}
              {v.note ? ` · ${v.note}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={!canRollback || rollingBackId !== null}
            onClick={() => onRollback(v.id)}
          >
            {rollingBackId === v.id ? "Rolling back…" : "Roll back to this"}
          </Button>
        </li>
      ))}
    </ul>
  );
}
