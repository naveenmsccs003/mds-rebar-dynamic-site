"""
Job-application submission flow (spec §16, docs/SECURITY.md
"Rate limiting / anti-spam", docs/FILE_STORAGE.md "Resume handling").

Kept out of the view so the same rules apply from any entry point:

* Idempotency-Key replay        -> return the original application
* same job + email within 10 min -> treated as a duplicate submission
* résumé validated + stored      -> private `documents.Document`
* every submission               -> an append-only `AuditLog` row
* HR notification                -> a queued `NotificationLog` row
                                   (the send pipeline itself is Phase 9)
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import log_action
from apps.notifications import services as notifications

from .models import JobApplication
from .uploads import store_resume

ENTITY = "applications.JobApplication"
DEDUPE_WINDOW = timedelta(minutes=10)


def client_ip(request) -> str | None:
    """`REMOTE_ADDR` only — `X-Forwarded-For` is trusted only once the
    deployment's proxy hop count is known (docs/DEPLOYMENT.md), matching
    `apps.accounts.services.client_ip`."""
    return request.META.get("REMOTE_ADDR") or None


def user_agent(request) -> str:
    return request.META.get("HTTP_USER_AGENT", "")[:500]


@dataclass
class SubmitResult:
    application: JobApplication
    created: bool


def _existing_for_key(key: str) -> JobApplication | None:
    return JobApplication.objects.filter(idempotency_key=key).first() if key else None


def _recent_duplicate(job, email: str) -> JobApplication | None:
    return (
        JobApplication.objects.filter(
            job=job,
            email__iexact=email,
            created_at__gte=timezone.now() - DEDUPE_WINDOW,
        )
        .order_by("-created_at")
        .first()
    )


def submit_application(request, *, data: dict, resume_file, idempotency_key: str = "") -> SubmitResult:
    """Create a `JobApplication` from validated serializer `data`, or
    return the already-stored one on an idempotent / duplicate replay."""
    replay = _existing_for_key(idempotency_key)
    if replay is not None:
        return SubmitResult(replay, created=False)

    duplicate = _recent_duplicate(data["job"], data["email"])
    if duplicate is not None:
        return SubmitResult(duplicate, created=False)

    document = store_resume(resume_file)

    try:
        with transaction.atomic():
            application = JobApplication.objects.create(
                job=data["job"],
                name=data["name"],
                email=data["email"],
                phone=data.get("phone", ""),
                cover_letter=data.get("cover_letter", ""),
                additional_info=data.get("additional_info", ""),
                resume=document,
                idempotency_key=idempotency_key,
                ip_address=client_ip(request),
                user_agent=user_agent(request),
            )
    except IntegrityError:
        # A concurrent request with the same Idempotency-Key won the race
        # against the unique constraint — return its application.
        existing = _existing_for_key(idempotency_key)
        if existing is not None:
            document.delete()  # ours is now orphaned
            return SubmitResult(existing, created=False)
        raise

    log_action(
        action="application.submitted",
        entity_type=ENTITY,
        entity_id=application.pk,
        actor=None,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
        after={"job": data["job"].slug, "email": application.email},
    )
    _queue_hr_notification(application)
    return SubmitResult(application, created=True)


def record_admin_change(request, application: JobApplication, before: dict, after: dict) -> None:
    """Audit an HR-side status / assignment change (docs/SECURITY.md
    "Audit logging")."""
    if before == after:
        return
    log_action(
        action="application.updated",
        entity_type=ENTITY,
        entity_id=application.pk,
        actor=getattr(request, "user", None),
        ip_address=client_ip(request),
        user_agent=user_agent(request),
        before=before,
        after=after,
    )


def _queue_hr_notification(application: JobApplication) -> None:
    """Alert the careers inbox that a new application arrived. Routed
    through `apps.notifications` (Phase 9) — queued row + Celery send,
    never fatal to the submission."""
    notifications.queue(
        template="job_application_internal",
        recipient=settings.CAREERS_NOTIFICATION_EMAIL,
        subject=f"New job application: {application.job.title}",
        context={
            "reference": str(application.uuid),
            "job_title": application.job.title,
            "job_slug": application.job.slug,
            "name": application.name,
            "email": application.email,
            "phone": application.phone,
        },
        related_object=application,
    )
