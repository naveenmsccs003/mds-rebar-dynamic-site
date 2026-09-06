"""
Résumé upload validation + storage (docs/SECURITY.md "File uploads",
docs/FILE_STORAGE.md "Resume handling").

The public career-application endpoint is the only place an anonymous
user can put a file into the system, so every check here is server-side
and nothing the browser says is trusted:

* size ceiling        — ``settings.RESUME_UPLOAD_MAX_BYTES``
* extension allow-list — ``settings.RESUME_UPLOAD_ALLOWED_EXTENSIONS``
* content sniffing    — the leading bytes must match the claimed type,
                        so a ``.pdf`` that is not actually a PDF (or an
                        HTML/script file renamed to ``.pdf``) is refused
* randomised object key — the stored name is a UUID; the uploaded
                        filename is kept only as ``Document.original_filename``
* SHA-256 checksum     — recorded on the ``Document`` row

Object storage, presigned uploads and malware scanning are Phase 10;
``scan_hook()`` marks the single place that pipeline attaches. Until
then the validated bytes are written through Django's configured storage
backend under a private, non-guessable prefix and the ``Document`` is
left ``status = PENDING``.
"""
from __future__ import annotations

import hashlib
import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework import serializers

from apps.documents.models import Document, ProcessingStatus, Visibility

# Leading-byte signatures for each allowed type. A file whose first bytes
# match none of the signatures for its extension is rejected.
_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF-",),
    # OLE2 compound document (legacy .doc)
    "doc": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    # ZIP container (.docx is a zip of XML parts); include the empty- and
    # spanned-archive markers for completeness.
    "docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
}

_CONTENT_TYPE: dict[str, str] = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class ResumeValidationError(serializers.ValidationError):
    """A bad résumé upload — rendered as a 400 ``VALIDATION_ERROR`` in the
    response envelope, on the ``resume`` field."""

    def __init__(self, message: str):
        super().__init__({"resume": [message]})


def _extension(filename: str) -> str:
    _, _, ext = (filename or "").rpartition(".")
    return ext.lower().strip()


def validate_resume(uploaded_file) -> str:
    """Run every server-side check on ``uploaded_file`` (a Django
    ``UploadedFile``). Returns the validated lowercase extension, or
    raises :class:`ResumeValidationError`."""
    if uploaded_file is None:
        raise ResumeValidationError("A résumé file is required.")

    size = uploaded_file.size or 0
    if size == 0:
        raise ResumeValidationError("The résumé file is empty.")

    max_bytes = settings.RESUME_UPLOAD_MAX_BYTES
    if size > max_bytes:
        raise ResumeValidationError(
            f"The résumé must be {max_bytes // (1024 * 1024)} MB or smaller."
        )

    allowed = settings.RESUME_UPLOAD_ALLOWED_EXTENSIONS
    ext = _extension(uploaded_file.name)
    if ext not in allowed:
        pretty = ", ".join(f".{e}" for e in allowed)
        raise ResumeValidationError(
            f"Unsupported file type '.{ext or '?'}'. Allowed: {pretty}."
        )

    head = uploaded_file.read(8)
    uploaded_file.seek(0)
    if not any(head.startswith(sig) for sig in _SIGNATURES[ext]):
        raise ResumeValidationError("The file content does not match its extension.")

    return ext


def scan_hook(document: Document) -> None:
    """Placeholder for the malware-scan step (Phase 10 / Phase 12
    upload-validation audit). When that lands it runs asynchronously and
    flips ``document.status`` to ``PROCESSED`` / ``FAILED``; HR tooling
    must not surface a download for anything still ``PENDING``."""
    return None


def store_resume(uploaded_file, *, ext: str, owner=None) -> Document:
    """Persist a *validated* upload (call :func:`validate_resume` first):
    randomised key, SHA-256 checksum, private ``Document`` row left
    ``PENDING`` for :func:`scan_hook`."""
    digest = hashlib.sha256()
    for chunk in uploaded_file.chunks():
        digest.update(chunk)
    uploaded_file.seek(0)

    key = f"{settings.RESUME_UPLOAD_STORAGE_PREFIX}/{uuid.uuid4().hex}.{ext}"
    object_key = default_storage.save(key, uploaded_file)

    document = Document.objects.create(
        object_key=object_key,
        original_filename=(uploaded_file.name or "")[:255],
        content_type=_CONTENT_TYPE[ext],
        size_bytes=uploaded_file.size,
        checksum=digest.hexdigest(),
        owner=owner,
        visibility=Visibility.PRIVATE,
        status=ProcessingStatus.PENDING,
    )
    scan_hook(document)
    return document
