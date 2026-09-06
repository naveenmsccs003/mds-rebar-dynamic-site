"""
Notification dispatch (spec §32/§69, docs/DATABASE_DESIGN.md
"notifications").

`queue()` is the single entry point every feature calls (Phase 8 job
applications, Phase 9 quote / contact, later phases). It writes a
`NotificationLog` row up front — so the intent is durable and auditable
even if delivery fails — then hands the row id to the Celery task in
`apps.notifications.tasks`. Delivery never happens inside the web
request, and a send failure never propagates back to the caller: the
worst case is a `failed` row the worker retries.
"""
from __future__ import annotations

import logging

from django.contrib.contenttypes.models import ContentType
from django.db import models

from .models import NotificationLog, NotificationStatus

logger = logging.getLogger(__name__)


def queue(
    *,
    template: str,
    recipient: str,
    subject: str,
    context: dict,
    related_object: models.Model | None = None,
) -> NotificationLog | None:
    """Create a queued `NotificationLog` and dispatch its delivery task.

    `recipient` may be empty (no address configured) — nothing is queued
    and `None` is returned. Any failure to enqueue is swallowed and
    logged; the triggering request must not break because a notification
    could not be scheduled.
    """
    if not recipient:
        return None

    fields: dict = {}
    if related_object is not None and related_object.pk is not None:
        fields["related_content_type"] = ContentType.objects.get_for_model(type(related_object))
        fields["related_object_id"] = related_object.pk

    try:
        log = NotificationLog.objects.create(
            channel="email",
            recipient=recipient,
            template=template,
            status=NotificationStatus.QUEUED,
            **fields,
        )
    except Exception:  # noqa: BLE001 - a notification must never break intake
        logger.exception("Could not create NotificationLog for template %r", template)
        return None

    from .tasks import send_notification

    try:
        send_notification.delay(log.pk, subject=subject, context=context)
    except Exception:  # noqa: BLE001 - broker down: leave the row queued for a sweep
        logger.exception("Could not dispatch send_notification for log %s", log.pk)

    return log
