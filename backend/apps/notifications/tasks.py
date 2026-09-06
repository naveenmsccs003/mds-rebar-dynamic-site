"""
Notification delivery worker (docs/DATABASE_DESIGN.md "notifications":
"a failed email is retried by Celery and never silently lost or allowed
to crash the request that triggered it").

`send_notification` renders `notifications/email/<template>.txt` with the
supplied context, sends it, and records the outcome on the
`NotificationLog` row. On failure it bumps `attempts` / `last_error` and
retries with exponential backoff up to `max_retries`; the final failure
leaves a `failed` row for operators, it does not raise past the worker.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

from .models import NotificationLog, NotificationStatus

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="notifications.send_notification",
    max_retries=5,
    default_retry_delay=60,
)
def send_notification(self, log_id: int, *, subject: str, context: dict) -> str:
    try:
        log = NotificationLog.objects.get(pk=log_id)
    except NotificationLog.DoesNotExist:
        logger.warning("send_notification: NotificationLog %s is gone", log_id)
        return "missing"

    if log.status == NotificationStatus.SENT:
        return "already-sent"

    log.attempts += 1
    body = render_to_string(f"notifications/email/{log.template}.txt", context)

    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [log.recipient], fail_silently=False)
    except Exception as exc:  # noqa: BLE001 - recorded + retried, never propagated
        log.status = NotificationStatus.FAILED
        log.last_error = str(exc)[:2000]
        log.save(update_fields=["status", "attempts", "last_error", "updated_at"])
        logger.warning("Notification %s failed (attempt %s): %s", log_id, log.attempts, exc)
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return "failed"

    log.status = NotificationStatus.SENT
    log.last_error = ""
    log.save(update_fields=["status", "attempts", "last_error", "updated_at"])
    return "sent"
