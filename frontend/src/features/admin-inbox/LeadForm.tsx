/**
 * The editable half of a lead drawer (quote request / enquiry): pick a
 * next `status` from the lifecycle graph and/or set an assignee, then
 * PATCH both in one request. The Save button is disabled — not hidden —
 * when the role lacks the permission the pending change needs
 * (`leadLifecycle.ts` mirrors the server rule; the server re-checks).
 * An assignee is entered as a numeric user id until an assignee picker
 * lands (a later admin sub-phase), with the current assignee's email
 * shown alongside.
 */
import { useState } from "react";

import { ApiRequestError } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { usePermissionChecker } from "../auth/usePermission";
import {
  LEAD_STATUS_LABELS,
  TRANSITION_LABELS,
  type LeadModel,
  requiredPermForAssign,
  requiredPermForTransition,
} from "./leadLifecycle";
import type { LeadStatus } from "./types";

interface Props {
  model: LeadModel;
  status: LeadStatus;
  allowedTransitions: LeadStatus[];
  assignedTo: number | null;
  assignedToEmail: string;
  busy: boolean;
  error: unknown;
  onSave: (body: { status: LeadStatus; assigned_to: number | null }) => void;
}

export function LeadForm({
  model,
  status,
  allowedTransitions,
  assignedTo,
  assignedToEmail,
  busy,
  error,
  onSave,
}: Props) {
  const can = usePermissionChecker();
  const [nextStatus, setNextStatus] = useState<LeadStatus>(status);
  const [assignee, setAssignee] = useState<string>(assignedTo == null ? "" : String(assignedTo));

  const parsedAssignee = assignee.trim() === "" ? null : Number(assignee);
  const assigneeInvalid = assignee.trim() !== "" && !Number.isInteger(parsedAssignee);
  const assignmentChanged = parsedAssignee !== assignedTo;
  const statusChanged = nextStatus !== status;
  const dirty = statusChanged || assignmentChanged;

  const needed: string[] = [];
  if (statusChanged) needed.push(requiredPermForTransition(model, nextStatus));
  if (assignmentChanged) needed.push(requiredPermForAssign(model));
  const permitted = needed.every((p) => can(p));

  const options: LeadStatus[] = [status, ...allowedTransitions.filter((s) => s !== status)];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || assigneeInvalid) return;
    onSave({ status: nextStatus, assigned_to: parsedAssignee });
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="form__field">
        <span>Status</span>
        <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as LeadStatus)}>
          {options.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
              {s === status ? " (current)" : ` — ${TRANSITION_LABELS[s]}`}
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
          aria-invalid={assigneeInvalid || undefined}
          onChange={(e) => setAssignee(e.target.value)}
        />
        <span className="admin-muted">
          {assignedToEmail ? `Currently ${assignedToEmail}` : "Currently unassigned"}
        </span>
        {assigneeInvalid && <span className="form__error">Enter a whole number, or leave blank.</span>}
      </label>

      {!permitted && dirty && (
        <p className="form__error" role="alert">
          Your role can’t make this change ({needed.join(", ")}).
        </p>
      )}
      {error instanceof ApiRequestError && (
        <p className="form__error" role="alert">
          {error.message}
        </p>
      )}

      <Button type="submit" disabled={busy || !dirty || assigneeInvalid || !permitted}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
