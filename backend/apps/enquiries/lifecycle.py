"""
Shared lead lifecycle for `quotations.QuoteRequest` and
`contact.Enquiry` — both use the same status set
(NEW / ASSIGNED / IN_PROGRESS / RESPONDED / CLOSED / SPAM) and the same
"an editor cannot silently close or reassign" permission split
(docs/RBAC_DESIGN.md).

`apps.enquiries` has no model of its own; it is the natural home for the
behaviour the two enquiry-like apps have in common.
"""
from __future__ import annotations

from rest_framework.exceptions import ValidationError

NEW = "new"
ASSIGNED = "assigned"
IN_PROGRESS = "in_progress"
RESPONDED = "responded"
CLOSED = "closed"
SPAM = "spam"

# Allowed target states from each current state. Deliberately permissive
# between the working states; the guardrails are the *permissions* below,
# not the graph.
TRANSITIONS: dict[str, set[str]] = {
    NEW: {ASSIGNED, IN_PROGRESS, RESPONDED, CLOSED, SPAM},
    ASSIGNED: {NEW, IN_PROGRESS, RESPONDED, CLOSED, SPAM},
    IN_PROGRESS: {ASSIGNED, RESPONDED, CLOSED, SPAM},
    RESPONDED: {IN_PROGRESS, CLOSED, SPAM},
    CLOSED: {IN_PROGRESS},   # reopen
    SPAM: {NEW},             # not spam after all
}


class InvalidLeadTransition(ValidationError):
    envelope_code = "INVALID_TRANSITION"


def allowed_targets(status: str) -> set[str]:
    return TRANSITIONS.get(status, set())


def check_transition(current: str, target: str) -> None:
    if current == target:
        return
    if target not in allowed_targets(current):
        raise InvalidLeadTransition(
            f"Cannot move from '{current}' to '{target}'. "
            f"Allowed: {sorted(allowed_targets(current)) or 'none'}."
        )


def required_permission(model, *, target: str | None, assignment_changed: bool) -> str:
    """`<app_label>.<codename>` the acting user must hold for this change.

    * changing the assignee, or moving to ASSIGNED   -> `assign_<model>`
    * moving to RESPONDED                             -> `respond_<model>`
    * moving to CLOSED                                -> `close_<model>`
    * anything else                                   -> `change_<model>`

    Custom verbs fall back to `change_<model>` for a model that does not
    define them (QuoteRequest has no `respond_quoterequest`).
    """
    meta = model._meta
    custom = {codename for codename, _ in meta.permissions}

    def perm(verb: str) -> str:
        codename = f"{verb}_{meta.model_name}"
        return f"{meta.app_label}.{codename if codename in custom else f'change_{meta.model_name}'}"

    if assignment_changed or target == ASSIGNED:
        return perm("assign")
    if target == RESPONDED:
        return perm("respond")
    if target == CLOSED:
        return perm("close")
    return f"{meta.app_label}.change_{meta.model_name}"
