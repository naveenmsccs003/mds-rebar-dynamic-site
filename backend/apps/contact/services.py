"""
Enquiry business logic (spec §18). Kept out of views/serializers so the
same rules apply to any future entry point.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.audit.services import log_action
from apps.notifications import services as notifications

from .models import Enquiry, EnquiryReferenceSequence

ENTITY = "contact.Enquiry"
DEDUPE_WINDOW = timedelta(minutes=10)


def generate_enquiry_reference(year: int | None = None) -> str:
    """Same atomic-counter pattern as `apps.quotations.services.generate_quote_reference`
    (docs/DATABASE_DESIGN.md) — kept as a separate sequence/prefix ('MDS-E-')
    since enquiries and quotes are different business objects."""
    year = year or timezone.now().year
    with transaction.atomic():
        sequence, _ = EnquiryReferenceSequence.objects.select_for_update().get_or_create(year=year)
        sequence.last_number += 1
        sequence.save(update_fields=["last_number"])
        return f"MDS-E-{year}-{sequence.last_number:06d}"


def create_enquiry(**fields) -> Enquiry:
    with transaction.atomic():
        fields["public_reference"] = generate_enquiry_reference()
        return Enquiry.objects.create(**fields)


# --- public submission ------------------------------------------------


@dataclass
class SubmitResult:
    enquiry: Enquiry
    created: bool


def _client_ip(request) -> str | None:
    return request.META.get("REMOTE_ADDR") or None


def _user_agent(request) -> str:
    return request.META.get("HTTP_USER_AGENT", "")[:500]


def submit_enquiry(request, *, data: dict) -> SubmitResult:
    """Create an `Enquiry` from validated serializer `data`. Enquiries
    have no idempotency key (the model doesn't carry one); a same-email
    submission inside a short window is still coalesced so a double-click
    doesn't create two."""
    recent = (
        Enquiry.objects.filter(
            email__iexact=data["email"],
            message=data.get("message", ""),
            created_at__gte=timezone.now() - DEDUPE_WINDOW,
        )
        .order_by("-created_at")
        .first()
    )
    if recent is not None:
        return SubmitResult(recent, created=False)

    enquiry = create_enquiry(
        enquiry_type=data.get("enquiry_type", "contact"),
        name=data["name"],
        email=data["email"],
        phone=data.get("phone", ""),
        company=data.get("company", ""),
        message=data["message"],
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
    )
    log_action(
        action="enquiry.submitted",
        entity_type=ENTITY,
        entity_id=enquiry.pk,
        actor=None,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
        after={"reference": enquiry.public_reference, "email": enquiry.email},
    )
    _notify(enquiry)
    return SubmitResult(enquiry, created=True)


def record_admin_change(request, enquiry: Enquiry, before: dict, after: dict) -> None:
    if before == after:
        return
    log_action(
        action="enquiry.updated",
        entity_type=ENTITY,
        entity_id=enquiry.pk,
        actor=getattr(request, "user", None),
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
        before=before,
        after=after,
    )


def _notify(enquiry: Enquiry) -> None:
    context = {
        "reference": enquiry.public_reference,
        "enquiry_type": enquiry.get_enquiry_type_display(),
        "name": enquiry.name,
        "email": enquiry.email,
        "phone": enquiry.phone,
        "company": enquiry.company,
        "message": enquiry.message,
    }
    notifications.queue(
        template="enquiry_acknowledgement",
        recipient=enquiry.email,
        subject=f"We received your enquiry ({enquiry.public_reference})",
        context=context,
        related_object=enquiry,
    )
    notifications.queue(
        template="enquiry_internal",
        recipient=settings.SALES_NOTIFICATION_EMAIL,
        subject=f"New enquiry: {enquiry.public_reference}",
        context=context,
        related_object=enquiry,
    )
