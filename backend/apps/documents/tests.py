import pytest
from django.db import IntegrityError

from .models import Document, DownloadLog, Visibility


@pytest.mark.django_db
def test_document_defaults_to_private_visibility():
    """docs/SECURITY.md: private-by-default so a forgotten visibility
    field never accidentally exposes an upload publicly."""
    document = Document.objects.create(
        object_key="a1b2c3d4e5f6",
        original_filename="resume.pdf",
        content_type="application/pdf",
        size_bytes=1024,
    )
    assert document.visibility == Visibility.PRIVATE


@pytest.mark.django_db
def test_object_key_must_be_unique():
    Document.objects.create(
        object_key="dup-key", original_filename="a.pdf", content_type="application/pdf", size_bytes=1
    )
    with pytest.raises(IntegrityError):
        Document.objects.create(
            object_key="dup-key", original_filename="b.pdf", content_type="application/pdf", size_bytes=1
        )


@pytest.mark.django_db
def test_download_log_records_access():
    document = Document.objects.create(
        object_key="k1", original_filename="resume.pdf", content_type="application/pdf", size_bytes=10
    )
    log = DownloadLog.objects.create(document=document, ip_address="127.0.0.1")
    assert document.download_logs.count() == 1
    assert log.document == document
