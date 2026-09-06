"""
Asynchronous document processing (docs/FILE_STORAGE.md "Validation" — "a
hook point for malware scanning before a file is marked usable").

``scan_document`` is the single place a real anti-virus / content scan
attaches (ClamAV, an S3 malware-scan lambda, a third-party API). Until
one is wired in, :func:`_scan` is a conservative stub that accepts the
file; the important part already works — nothing is downloadable while
``Document.status`` is ``pending``, and a failing scan deletes the
object and marks the row ``failed``.
"""
from __future__ import annotations

import logging

from celery import shared_task

from .models import Document, ProcessingStatus
from .services import mark_scanned
from .storage import get_storage

logger = logging.getLogger(__name__)


def _scan(data: bytes, *, content_type: str) -> bool:
    """Return True if the bytes are clean. Placeholder — real scanning
    integration goes here (Phase 12 upload-validation audit tracks it)."""
    return True


@shared_task(bind=True, name="documents.scan_document", max_retries=3, default_retry_delay=30)
def scan_document(self, document_id: int) -> str:
    try:
        document = Document.objects.get(pk=document_id)
    except Document.DoesNotExist:
        return "missing"

    if document.status == ProcessingStatus.PROCESSED:
        return "already-processed"

    storage = get_storage()
    if not storage.exists(document.object_key):
        logger.warning("scan_document: object %s missing for doc %s", document.object_key, document_id)
        return "no-object"

    with storage.open(document.object_key) as fh:
        data = fh.read()

    clean = _scan(data, content_type=document.content_type)
    mark_scanned(document, clean=clean)
    return "processed" if clean else "failed"
