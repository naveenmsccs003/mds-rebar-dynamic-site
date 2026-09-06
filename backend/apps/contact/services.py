from django.db import transaction
from django.utils import timezone

from .models import Enquiry, EnquiryReferenceSequence


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
