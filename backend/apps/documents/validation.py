"""
Server-side upload validation (docs/SECURITY.md "File uploads",
docs/FILE_STORAGE.md "Validation"). Every check here runs on the server;
the browser-supplied filename and ``Content-Type`` are never trusted.

Two entry points, for the two upload shapes:

* :func:`validate_declared` — the presigned flow, before any bytes exist:
  checks the *claimed* extension / size / content type against a policy.
* :func:`sniff` — once bytes are in hand (the direct server-side store,
  e.g. the public résumé upload, and the ``complete`` step of the
  presigned flow): the leading bytes must match the claimed type.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

from django.conf import settings
from rest_framework import serializers

# Leading-byte signatures per extension. ``()`` means "no reliable magic"
# (plain text / csv) — those pass the sniff on extension + declared type
# alone, which is acceptable for the low-risk types they cover.
_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF-",),
    "doc": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    "docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    "xlsx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "csv": (),
    "txt": (),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "webp": (b"RIFF",),
    "gif": (b"GIF87a", b"GIF89a"),
}

_CONTENT_TYPE: dict[str, str] = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
    "txt": "text/plain",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "gif": "image/gif",
}

_MB = 1024 * 1024


@dataclass(frozen=True)
class UploadPolicy:
    category: str
    max_bytes: int
    extensions: tuple[str, ...]


POLICIES: dict[str, UploadPolicy] = {
    "resume": UploadPolicy("resume", 5 * _MB, ("pdf", "doc", "docx")),
    "document": UploadPolicy(
        "document", 25 * _MB, ("pdf", "doc", "docx", "xls", "xlsx", "csv", "txt")
    ),
    "image": UploadPolicy("image", 10 * _MB, ("jpg", "jpeg", "png", "webp", "gif")),
}


class UploadValidationError(serializers.ValidationError):
    """400 ``VALIDATION_ERROR`` — carries the offending field."""

    def __init__(self, message: str, field: str = "file"):
        super().__init__({field: [message]})


def get_policy(category: str) -> UploadPolicy:
    try:
        base = POLICIES[category]
    except KeyError:
        raise UploadValidationError(
            f"Unknown upload category '{category}'. One of: {', '.join(sorted(POLICIES))}.",
            field="category",
        )
    # The résumé policy stays configurable via the settings the public
    # career form documented (`RESUME_UPLOAD_*`).
    if category == "resume":
        return replace(
            base,
            max_bytes=settings.RESUME_UPLOAD_MAX_BYTES,
            extensions=tuple(settings.RESUME_UPLOAD_ALLOWED_EXTENSIONS),
        )
    return base


def extension_of(filename: str) -> str:
    _, _, ext = (filename or "").rpartition(".")
    return ext.lower().strip()


def content_type_for(ext: str) -> str:
    return _CONTENT_TYPE.get(ext, "application/octet-stream")


def validate_declared(policy: UploadPolicy, *, filename: str, size: int, content_type: str = "") -> str:
    """Check a *declared* upload (no bytes yet). Returns the validated
    lowercase extension or raises :class:`UploadValidationError`."""
    if not size or size <= 0:
        raise UploadValidationError("File size must be provided and non-zero.", field="size")
    if size > policy.max_bytes:
        raise UploadValidationError(
            f"File exceeds the {policy.max_bytes // _MB} MB limit for {policy.category} uploads.",
            field="size",
        )

    ext = extension_of(filename)
    if ext not in policy.extensions:
        allowed = ", ".join(f".{e}" for e in policy.extensions)
        raise UploadValidationError(
            f"Unsupported file type '.{ext or '?'}'. Allowed: {allowed}.", field="filename"
        )

    expected = _CONTENT_TYPE[ext]
    if content_type and content_type != expected and content_type != "application/octet-stream":
        raise UploadValidationError(
            f"Declared content type '{content_type}' does not match '.{ext}'.", field="content_type"
        )
    return ext


def sniff(policy: UploadPolicy, ext: str, head: bytes) -> None:
    """The leading bytes must match ``ext``. No-op for types with no
    reliable magic number (plain text / csv)."""
    signatures = _SIGNATURES.get(ext, ())
    if not signatures:
        return
    if not any(head.startswith(sig) for sig in signatures):
        raise UploadValidationError("The file content does not match its extension.", field="file")
