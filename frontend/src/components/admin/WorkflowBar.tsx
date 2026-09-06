/**
 * Publishing-workflow controls (docs/RBAC_DESIGN.md "Publishing workflow
 * gating"). One button per `allowedTransitions` entry; a move to or from
 * PUBLISHED needs `<app>.publish_<model>`, everything else
 * `<app>.change_<model>` — the button is disabled (not hidden) when the
 * role lacks it, so it's discoverable but not usable. The server
 * re-checks regardless.
 */
import { useState } from "react";

import { usePermissionChecker } from "../../features/auth/usePermission";
import { Button } from "../Button/Button";

const LABEL: Record<string, string> = {
  draft: "Back to draft",
  review: "Submit for review",
  approved: "Approve",
  published: "Publish",
  archived: "Archive",
};

export interface WorkflowBarProps {
  status: string;
  allowedTransitions: string[];
  /** `<app_label>.<model_name>`, e.g. `pages.pagesection`. */
  permBase: string;
  busy?: boolean;
  onTransition: (to: string, note: string) => void;
}

export function WorkflowBar({
  status,
  allowedTransitions,
  permBase,
  busy,
  onTransition,
}: WorkflowBarProps) {
  const can = usePermissionChecker();
  const [note, setNote] = useState("");
  const [app, model] = permBase.split(".");

  function permFor(target: string): string {
    const verb = target === "published" || status === "published" ? "publish" : "change";
    return `${app}.${verb}_${model}`;
  }

  if (allowedTransitions.length === 0) {
    return <p className="admin-muted">No workflow moves available from “{status}”.</p>;
  }

  return (
    <div className="workflow-bar">
      <p className="admin-muted">
        Status: <strong>{status}</strong>
      </p>
      <label className="form__field">
        <span>Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
      </label>
      <div className="workflow-bar__actions">
        {allowedTransitions.map((to) => {
          const allowed = can(permFor(to));
          return (
            <Button
              key={to}
              type="button"
              variant={to === "published" ? "primary" : "secondary"}
              disabled={busy || !allowed}
              title={allowed ? undefined : `Requires ${permFor(to)}`}
              onClick={() => onTransition(to, note)}
            >
              {LABEL[to] ?? to}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
