"""Phase 9 — notification dispatch: queued row + Celery send + failure recording."""
import pytest
from django.core import mail

from apps.careers.models import JobPosting

from .models import NotificationLog, NotificationStatus
from .services import queue


@pytest.mark.django_db
def test_queue_writes_a_row_and_sends_eagerly():
    job = JobPosting.objects.create(title="Detailer", slug="detailer")
    log = queue(
        template="job_application_internal",
        recipient="hr@mds.example",
        subject="New application",
        context={"reference": "abc", "job_title": "Detailer", "job_slug": "detailer",
                 "name": "Jane", "email": "jane@example.com", "phone": ""},
        related_object=job,
    )
    assert log is not None
    log.refresh_from_db()
    assert log.status == NotificationStatus.SENT
    assert log.attempts == 1
    assert log.related_object == job
    assert len(mail.outbox) == 1
    assert "hr@mds.example" in mail.outbox[0].to
    assert mail.outbox[0].subject == "New application"


@pytest.mark.django_db
def test_queue_is_a_noop_without_a_recipient():
    assert queue(template="enquiry_internal", recipient="", subject="x", context={}) is None
    assert NotificationLog.objects.count() == 0
    assert mail.outbox == []


@pytest.mark.django_db
def test_send_failure_is_recorded_on_the_row(monkeypatch):
    """A send error must land on the NotificationLog as FAILED + error
    text (the worker then retries / gives up on its own schedule — that
    part is Celery's, and `queue()` already shields the caller from it)."""
    from .tasks import send_notification

    def boom(*args, **kwargs):
        raise RuntimeError("smtp down")

    monkeypatch.setattr("apps.notifications.tasks.send_mail", boom)

    log = NotificationLog.objects.create(
        channel="email", recipient="someone@example.com",
        template="enquiry_acknowledgement", status=NotificationStatus.QUEUED,
    )
    # Outside a worker, `self.retry()` re-raises the original error rather
    # than a Retry signal — either way the row must already say FAILED.
    with pytest.raises(Exception):
        send_notification.run(
            log.pk, subject="hi", context={"name": "Sam", "reference": "MDS-E-2026-000001"}
        )

    log.refresh_from_db()
    assert log.status == NotificationStatus.FAILED
    assert "smtp down" in log.last_error
    assert log.attempts == 1
