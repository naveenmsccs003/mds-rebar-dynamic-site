"""
Document lifecycle (docs/FILE_STORAGE.md).

    issue_upload ── client PUTs bytes ──▶ finalize_upload ──▶ scan_document
                                                                   │
    Document.status:  pending ───────────────────────────▶ processed / failed

    issue_download ── authz check ──▶ DownloadLog ──▶ short-lived signed URL

Nothing here trusts the client past the policy check; the object key is
always random (never the uploaded filename), private by default, and a
download is refused until the scan has marked the file ``processed``.
"""
from __future__ import annotations

import hashlib
import logging
import re
import uuid

from django.conf import settings

from apps.audit.services import log_action

from .models import Document, DownloadLog, ProcessingStatus, Visibility
from .storage import get_storage
from .validation import (
    UploadPolicy,
    UploadValidationError,
    content_type_for,
    get_policy,
    sniff,
    validate_declared,
)

logger = logging.getLogger(__name__)

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(name: str) -> str:
    """Keep only the base name and a safe character set — used for
    metadata and for the ``Content-Disposition`` on download, never as
    the storage key."""
    base = (name or "").replace("\\", "/").split("/")[-1]
    cleaned = _SAFE_NAME.sub("_", base).strip("._") or "file"
    return cleaned[:255]


def _key(prefix: str, ext: str) -> str:
    return f"{prefix.strip('/')}/{uuid.uuid4().hex}.{ext}"


def _prefix(visibility: str, category: str) -> str:
    root = settings.DOCUMENT_PRIVATE_PREFIX if visibility == Visibility.PRIVATE else settings.DOCUMENT_PUBLIC_PREFIX
    return f"{root}/{category}s"


# --- direct server-side store (public résumé upload, seeds, imports) ---


def store_bytes(
    *,
    category: str,
    uploaded_file,
    owner=None,
    visibility: str = Visibility.PRIVATE,
) -> Document:
    """Validate an in-hand upload (``UploadedFile``) and persist it:
    magic-byte sniff, random key, SHA-256, ``Document`` row, scan queued.
    """
    policy = get_policy(category)
    size = uploaded_file.size or 0
    ext = validate_declared(policy, filename=uploaded_file.name or "", size=size)

    head = uploaded_file.read(8)
    uploaded_file.seek(0)
    sniff(policy, ext, head)

    digest = hashlib.sha256()
    for chunk in uploaded_file.chunks():
        digest.update(chunk)
    uploaded_file.seek(0)

    storage = get_storage()
    key = _key(_prefix(visibility, category), ext)
    object_key = storage.save(key, uploaded_file.read())
    uploaded_file.seek(0)

    document = Document.objects.create(
        object_key=object_key,
        original_filename=sanitize_filename(uploaded_file.name or ""),
        content_type=content_type_for(ext),
        size_bytes=size,
        checksum=digest.hexdigest(),
        owner=owner,
        visibility=visibility,
        status=ProcessingStatus.PENDING,
    )
    _queue_scan(document)
    return document


# --- presigned-style flow -------------------------------------------


def issue_upload(
    *,
    category: str,
    filename: str,
    size: int,
    content_type: str = "",
    owner=None,
    visibility: str = Visibility.PRIVATE,
) -> tuple[Document, "UploadTicketDict"]:
    """Validate a *declared* upload and hand back a ``Document`` row
    (``pending``) plus the ticket the client uses to send the bytes."""
    policy: UploadPolicy = get_policy(category)
    ext = validate_declared(policy, filename=filename, size=size, content_type=content_type)

    storage = get_storage()
    key = _key(_prefix(visibility, category), ext)
    resolved_ct = content_type or content_type_for(ext)
    ticket = storage.signed_upload(
        key,
        content_type=resolved_ct,
        max_bytes=policy.max_bytes,
        expires_in=settings.DOCUMENT_UPLOAD_URL_TTL,
    )

    document = Document.objects.create(
        object_key=key,
        original_filename=sanitize_filename(filename),
        content_type=resolved_ct,
        size_bytes=size,
        owner=owner,
        visibility=visibility,
        status=ProcessingStatus.PENDING,
    )
    return document, {
        "url": ticket.url,
        "method": ticket.method,
        "headers": ticket.headers,
        "expires_in": ticket.expires_in,
    }


def finalize_upload(document: Document) -> Document:
    """Called after the client reports its upload finished: confirm the
    object landed, record its real size + checksum, queue the scan."""
    storage = get_storage()
    if not storage.exists(document.object_key):
        raise UploadValidationError("No uploaded object found for this document.", field="document")

    with storage.open(document.object_key) as fh:
        data = fh.read()
    document.size_bytes = len(data)
    document.checksum = hashlib.sha256(data).hexdigest()
    document.status = ProcessingStatus.PENDING
    document.save(update_fields=["size_bytes", "checksum", "status", "updated_at"])
    _queue_scan(document)
    return document


UploadTicketDict = dict


# --- scanning ------------------------------------------------------


def _queue_scan(document: Document) -> None:
    from .tasks import scan_document

    try:
        scan_document.delay(document.pk)
    except Exception:
        # Broker unreachable — the row stays `pending` (not downloadable)
        # and a periodic sweep re-scans pending documents.
        logger.warning("could not queue scan for document %s", document.pk, exc_info=True)


# --- download ----------------------------------------------------


def can_download(user, document: Document) -> bool:
    if document.visibility == Visibility.PUBLIC:
        return True
    if not (user and user.is_authenticated):
        return False
    if document.owner_id and document.owner_id == user.id:
        return True
    return user.has_perm("documents.view_document")


def _ip(request) -> str | None:
    return request.META.get("REMOTE_ADDR") or None


def _ua(request) -> str:
    return request.META.get("HTTP_USER_AGENT", "")[:500]


class DownloadNotReady(Exception):
    """The file exists but has not cleared processing/scanning yet."""


class DownloadForbidden(Exception):
    """The requester is not allowed to access this document."""


def issue_download(document: Document, *, user, request, skip_authz: bool = False) -> dict:
    """Authorize, log, and mint a short-lived signed URL for `document`.

    `skip_authz=True` is for callers that have already run their own
    access check (e.g. a restricted-resource download gated on
    `resources.view_resource`, or HR pulling an application résumé). The
    `DownloadLog` + audit row are still written.

    Raises :class:`DownloadForbidden` / :class:`DownloadNotReady`.
    """
    if not skip_authz and not can_download(user, document):
        raise DownloadForbidden()
    if document.status != ProcessingStatus.PROCESSED:
        raise DownloadNotReady()

    DownloadLog.objects.create(
        document=document,
        user=user if (user and user.is_authenticated) else None,
        ip_address=_ip(request),
        user_agent=_ua(request),
    )
    log_action(
        action="document.downloaded",
        entity_type="documents.Document",
        entity_id=document.pk,
        actor=user if (user and user.is_authenticated) else None,
        ip_address=_ip(request),
        user_agent=_ua(request),
    )

    ttl = None if document.visibility == Visibility.PUBLIC else settings.DOCUMENT_DOWNLOAD_URL_TTL
    url = get_storage().signed_download_url(
        document.object_key, filename=document.original_filename or "download", expires_in=ttl
    )
    return {"url": url, "expires_in": ttl}


def public_url(document: Document | None) -> str | None:
    """A stable (non-expiring) signed URL for a *public*, *processed*
    document — what the content APIs put in an image's `url` field. `None`
    for anything private or not yet cleared by the scan."""
    if document is None or document.visibility != Visibility.PUBLIC:
        return None
    if document.status != ProcessingStatus.PROCESSED:
        return None
    return get_storage().signed_download_url(
        document.object_key, filename=document.original_filename or "image", expires_in=None
    )


def mark_scanned(document: Document, *, clean: bool) -> None:
    document.status = ProcessingStatus.PROCESSED if clean else ProcessingStatus.FAILED
    document.save(update_fields=["status", "updated_at"])
    if not clean:
        get_storage().delete(document.object_key)
    log_action(
        action="document.scanned",
        entity_type="documents.Document",
        entity_id=document.pk,
        actor=None,
        after={"status": document.status},
    )
