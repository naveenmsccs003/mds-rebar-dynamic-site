"""
Single write path for audit records, so every future call site (Phase 3
auth events, Phase 4 publishing, Phase 9 quote/enquiry workflow, Phase 10
document downloads, ...) records the same shape consistently rather than
constructing `AuditLog` rows ad hoc.
"""
from typing import Any

from .models import AuditLog


def log_action(
    *,
    action: str,
    entity_type: str,
    entity_id: Any,
    actor=None,
    ip_address: str | None = None,
    user_agent: str = "",
    before: dict | None = None,
    after: dict | None = None,
) -> AuditLog:
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        ip_address=ip_address,
        user_agent=user_agent,
        before=before,
        after=after,
    )
