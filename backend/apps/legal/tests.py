import pytest
from django.db import IntegrityError

from .models import LegalDocument, LegalDocumentType


@pytest.mark.django_db
def test_only_one_document_per_type():
    """Privacy Policy, Terms, NDA, Data Security are each a single
    CMS-editable document, not a list — `document_type` is unique."""
    LegalDocument.objects.create(document_type=LegalDocumentType.PRIVACY_POLICY, title="Privacy Policy")
    with pytest.raises(IntegrityError):
        LegalDocument.objects.create(document_type=LegalDocumentType.PRIVACY_POLICY, title="Duplicate")


@pytest.mark.django_db
def test_defaults_to_unpublished():
    document = LegalDocument.objects.create(document_type=LegalDocumentType.TERMS, title="Terms")
    assert document.is_published is False
