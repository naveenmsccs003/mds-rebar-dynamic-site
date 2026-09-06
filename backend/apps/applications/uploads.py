"""
Résumé upload — a thin adapter over the shared document pipeline
(`apps.documents`). Kept as its own module so the public
career-application code reads clearly and so the field name in the error
envelope stays `resume` (not the generic `file`).

Server-side validation, magic-byte sniffing, randomised private key,
SHA-256, and the malware-scan hook all live in `apps.documents`
(`validation` + `services.store_bytes` + `tasks.scan_document`).
"""
from __future__ import annotations

from rest_framework import serializers

from apps.documents import services as documents
from apps.documents.models import Document, Visibility
from apps.documents.validation import UploadValidationError

CATEGORY = "resume"


def _as_resume_error(exc: UploadValidationError) -> serializers.ValidationError:
    """Re-key any field on the generic upload error to `resume`."""
    messages: list[str] = []
    detail = exc.detail
    if isinstance(detail, dict):
        for value in detail.values():
            messages.extend(value if isinstance(value, list) else [value])
    else:
        messages.extend(detail if isinstance(detail, list) else [detail])
    return serializers.ValidationError({"resume": [str(m) for m in messages]})


def store_resume(uploaded_file, *, owner=None) -> Document:
    """Validate and persist a résumé upload, returning its `Document`
    (private, queued for scanning). Raises a `resume`-keyed
    `ValidationError` on a bad file."""
    if uploaded_file is None:
        raise serializers.ValidationError({"resume": ["A résumé file is required."]})
    try:
        return documents.store_bytes(
            category=CATEGORY, uploaded_file=uploaded_file, owner=owner,
            visibility=Visibility.PRIVATE,
        )
    except UploadValidationError as exc:
        raise _as_resume_error(exc) from None
