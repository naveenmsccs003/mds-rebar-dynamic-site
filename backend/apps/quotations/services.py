"""
Business logic kept out of views/serializers (docs/API_DESIGN.md,
spec §58) so it's independently testable and reusable from both the
Phase 9 API and any future channel (admin action, import job, ...).
"""
from django.db import transaction
from django.utils import timezone

from .models import QuoteReferenceSequence, QuoteRequest


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
    with transaction.atomic():
        fields["public_reference"] = generate_quote_reference()
        return QuoteRequest.objects.create(**fields)
