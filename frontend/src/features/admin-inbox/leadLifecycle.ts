/**
 * Client-side mirror of `apps.enquiries.lifecycle.required_permission` so
 * the Inbox status bar can disable (not hide) a move the role can't make.
 * The server re-checks every transition regardless — this is UX only.
 *
 *   change assignee, or move to ASSIGNED  -> assign_<model>
 *   move to RESPONDED                      -> respond_<model>
 *   move to CLOSED                         -> close_<model>
 *   anything else                          -> change_<model>
 *
 * A model without a custom verb (QuoteRequest has no `respond_*`) falls
 * back to `change_<model>` for that move, matching the backend.
 */
import type { LeadStatus } from "./types";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In progress",
  responded: "Responded",
  closed: "Closed",
  spam: "Spam",
};

export const TRANSITION_LABELS: Record<LeadStatus, string> = {
  new: "Reopen as new",
  assigned: "Mark assigned",
  in_progress: "Start work",
  responded: "Mark responded",
  closed: "Close",
  spam: "Mark as spam",
};

export interface LeadModel {
  /** `<app_label>.<model_name>`, e.g. `quotations.quoterequest`. */
  permBase: string;
  /** Custom lifecycle verbs this model actually defines. */
  customVerbs: ReadonlyArray<"assign" | "respond" | "close">;
}

export const QUOTE_MODEL: LeadModel = {
  permBase: "quotations.quoterequest",
  customVerbs: ["assign", "close"],
};

export const ENQUIRY_MODEL: LeadModel = {
  permBase: "contact.enquiry",
  customVerbs: ["assign", "respond", "close"],
};

export function requiredPermForTransition(model: LeadModel, target: LeadStatus): string {
  const [app, name] = model.permBase.split(".");
  const perm = (verb: "assign" | "respond" | "close") =>
    `${app}.${model.customVerbs.includes(verb) ? `${verb}_${name}` : `change_${name}`}`;

  if (target === "assigned") return perm("assign");
  if (target === "responded") return perm("respond");
  if (target === "closed") return perm("close");
  return `${app}.change_${name}`;
}

export function requiredPermForAssign(model: LeadModel): string {
  const [app, name] = model.permBase.split(".");
  return model.customVerbs.includes("assign") ? `${app}.assign_${name}` : `${app}.change_${name}`;
}
