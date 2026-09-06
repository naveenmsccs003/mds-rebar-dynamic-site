"""
Business logic kept out of views/serializers (docs/API_DESIGN.md,
spec §58) so it's independently testable and reusable from both the
Phase 9 API and any future channel (admin action, import job, ...).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import log_action
from apps.notifications import services as notifications

from .models import QuoteReferenceSequence, QuoteRequest

ENTITY = "quotations.QuoteRequest"
DEDUPE_WINDOW = timedelta(minutes=10)


def generate_quote_reference(year: int | None = None) -> str:
    """Returns the next `MDS-Q-<year>-<seq:06d>` reference, atomically.

    Uses `select_for_update()` on a per-year counter row rather than
    `QuoteRequest.objects.count() + 1`, which would race under concurrent
    submissions and could hand out a duplicate reference
    (docs/DATABASE_DESIGN.md "quotations").
    """
    year = year or timezone.now().year
    with transaction.atomic():
        sequence, _ = QuoteReferenceSequence.objects.select_for_update().get_or_create(year=year)
        sequence.last_number += 1
        sequence.save(update_fields=["last_number"])
        return f"MDS-Q-{year}-{sequence.last_number:06d}"


def create_quote_request(**fields) -> QuoteRequest:
    """Wraps reference generation + creation in one transaction so a
    request never ends up with a reserved reference number but no
    corresponding row (or vice versa)."""
    required_services = fields.pop("required_services", None)
    with transaction.atomic():
        fields["public_reference"] = generate_quote_reference()
        quote = QuoteRequest.objects.create(**fields)
        if required_services:
            quote.required_services.set(required_services)
        return quote


# --- public submission ------------------------------------------------


@dataclass
class SubmitResult:
    quote: QuoteRequest
    created: bool


def _client_ip(request) -> str | None:
    return request.META.get("REMOTE_ADDR") or None


def _user_agent(request) -> str:
    return request.META.get("HTTP_USER_AGENT", "")[:500]


def _existing_for_key(key: str) -> QuoteRequest | None:
    return QuoteRequest.objects.filter(idempotency_key=key).first() if key else None


def submit_quote_request(request, *, data: dict, idempotency_key: str = "") -> SubmitResult:
    """Create a `QuoteRequest` from validated serializer `data`, or return
    the already-stored one on an idempotent / duplicate replay."""
    replay = _existing_for_key(idempotency_key)
    if replay is not None:
        return SubmitResult(replay, created=False)

    recent = (
        QuoteRequest.objects.filter(
            email__iexact=data["email"],
            created_at__gte=timezone.now() - DEDUPE_WINDOW,
        )
        .order_by("-created_at")
        .first()
    )
    if recent is not None:
        return SubmitResult(recent, created=False)

    try:
        quote = create_quote_request(
            name=data["name"],
            company=data.get("company", ""),
            email=data["email"],
            phone=data.get("phone", ""),
            country=data.get("country"),
            service=data.get("service"),
            required_services=data.get("required_services") or [],
            project_type=data.get("project_type", ""),
            project_location=data.get("project_location", ""),
            project_size=data.get("project_size", ""),
            timeline=data.get("timeline", ""),
            message=data.get("message", ""),
            idempotency_key=idempotency_key or None,
            ip_address=_client_ip(request),
            user_agent=_user_agent(request),
        )
    except IntegrityError:
        existing = _existing_for_key(idempotency_key)
        if existing is not None:
            return SubmitResult(existing, created=False)
        raise

    log_action(
        action="quote_request.submitted",
        entity_type=ENTITY,
        entity_id=quote.pk,
        actor=None,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
        after={"reference": quote.public_reference, "email": quote.email},
    )
    _notify(quote)
    return SubmitResult(quote, created=True)


def record_admin_change(request, quote: QuoteRequest, before: dict, after: dict) -> None:
    if before == after:
        return
    log_action(
        action="quote_request.updated",
        entity_type=ENTITY,
        entity_id=quote.pk,
        actor=getattr(request, "user", None),
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
        before=before,
        after=after,
    )


def _notify(quote: QuoteRequest) -> None:
    context = {
        "reference": quote.public_reference,
        "name": quote.name,
        "company": quote.company,
        "email": quote.email,
        "phone": quote.phone,
        "country": quote.country.name if quote.country_id else "",
        "service": quote.service.name if quote.service_id else "",
        "project_type": quote.project_type,
        "project_location": quote.project_location,
        "project_size": quote.project_size,
        "timeline": quote.timeline,
        "message": quote.message,
    }
    notifications.queue(
        template="quote_request_acknowledgement",
        recipient=quote.email,
        subject=f"We received your quote request ({quote.public_reference})",
        context=context,
        related_object=quote,
    )
    notifications.queue(
        template="quote_request_internal",
        recipient=settings.SALES_NOTIFICATION_EMAIL,
        subject=f"New quote request: {quote.public_reference}",
        context=context,
        related_object=quote,
    )
