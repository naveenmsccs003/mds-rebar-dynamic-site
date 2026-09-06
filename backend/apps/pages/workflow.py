"""
Publishing workflow (spec §14/§22, docs/RBAC_DESIGN.md "Publishing
workflow gating").

    DRAFT --> REVIEW --> APPROVED --> PUBLISHED --> ARCHIVED
      ^         |           |            |            |
      +---------+-----------+------------+------------+   (back to DRAFT)

Two permissions, deliberately separate so an editor cannot put their own
work live:

  * `<app>.change_<model>`  — move a draft around the review states,
                              send an approved item back, restore from
                              archive, roll back.
  * `<app>.publish_<model>` — anything that changes what the public sees:
                              -> PUBLISHED, un-publishing, archiving a
                              live page.

Every transition snapshots the object (`apps.pages.versioning`) and
writes an `AuditLog` row.
"""
from __future__ import annotations

from django.utils import timezone

from apps.audit.services import log_action

from .exceptions import InvalidTransition
from .models import PublishStatus
from .versioning import snapshot

_S = PublishStatus

# Allowed target states from each current state.
TRANSITIONS: dict[str, set[str]] = {
    _S.DRAFT: {_S.REVIEW, _S.ARCHIVED},
    _S.REVIEW: {_S.DRAFT, _S.APPROVED, _S.ARCHIVED},
    _S.APPROVED: {_S.DRAFT, _S.PUBLISHED, _S.ARCHIVED},
    _S.PUBLISHED: {_S.DRAFT, _S.ARCHIVED},
    _S.ARCHIVED: {_S.DRAFT},
}

# Targets (or origins) that require the publish permission rather than
# just change.
_PUBLISH_SENSITIVE = {_S.PUBLISHED}


def allowed_targets(status: str) -> set[str]:
    return TRANSITIONS.get(status, set())


def required_permission(model, current: str, target: str) -> str:
    """`<app_label>.<codename>` needed to move `current -> target`."""
    meta = model._meta
    verb = (
        "publish"
        if target in _PUBLISH_SENSITIVE or current in _PUBLISH_SENSITIVE
        else "change"
    )
    return f"{meta.app_label}.{verb}_{meta.model_name}"


def can_transition(user, obj, target: str) -> bool:
    if target not in allowed_targets(obj.status):
        return False
    perm = required_permission(type(obj), obj.status, target)
    return bool(user and user.is_active and user.has_perm(perm))


def transition(obj, target: str, *, user, request=None, note: str = ""):
    """Move `obj` to `target`, or raise. Caller is responsible for the
    permission check (the CMS viewset does it via
    `HasRequiredPermissions`); `can_transition` is the shared predicate.

    Snapshots the new state and writes an audit row. Stamps
    `published_at` / clears `scheduled_publish_at` on the way in and out
    of PUBLISHED when the model has those fields.
    """
    current = obj.status
    if target not in allowed_targets(current):
        raise InvalidTransition(
            f"Cannot move from '{current}' to '{target}'. "
            f"Allowed: {sorted(allowed_targets(current)) or 'none'}."
        )

    obj.status = target

    if _has_field(obj, "published_at"):
        if target == _S.PUBLISHED:
            obj.published_at = timezone.now()
        elif current == _S.PUBLISHED:
            obj.published_at = None
    if _has_field(obj, "scheduled_publish_at") and target == _S.PUBLISHED:
        obj.scheduled_publish_at = None
    if _has_field(obj, "updated_by") and user is not None:
        obj.updated_by = user

    obj.save()
    version = snapshot(obj, user=user, note=note or f"{current} -> {target}")
    if _has_field(obj, "current_version"):
        type(obj).objects.filter(pk=obj.pk).update(current_version=version)
        obj.current_version_id = version.pk

    log_action(
        action=f"content.{target}",
        entity_type=f"{obj._meta.app_label}.{obj._meta.model_name}",
        entity_id=obj.pk,
        actor=user,
        ip_address=_ip(request),
        user_agent=_ua(request),
        before={"status": current},
        after={"status": target},
    )
    return obj


def publish_due(model, *, now=None) -> int:
    """Publish every APPROVED `model` row whose `scheduled_publish_at` has
    passed. Returns the count. Runs unattended (Celery beat) so `user` is
    None on these transitions."""
    now = now or timezone.now()
    due = model.objects.filter(
        status=_S.APPROVED,
        scheduled_publish_at__isnull=False,
        scheduled_publish_at__lte=now,
    )
    count = 0
    for obj in due:
        transition(obj, _S.PUBLISHED, user=None, note="scheduled publish")
        count += 1
    return count


def _has_field(obj, name: str) -> bool:
    return any(f.name == name for f in obj._meta.get_fields())


def _ip(request):
    return getattr(request, "META", {}).get("REMOTE_ADDR") if request else None


def _ua(request):
    return (getattr(request, "META", {}).get("HTTP_USER_AGENT", "") if request else "")[:500]
