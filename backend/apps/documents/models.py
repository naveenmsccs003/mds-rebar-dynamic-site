"""
Generic file metadata (docs/DATABASE_DESIGN.md "documents / media",
docs/FILE_STORAGE.md). The database never stores file bytes — only
metadata about an object living in object storage. The actual
presigned-upload / storage-provider wiring is built in Phase 10; this
model is deliberately storage-provider-agnostic so that phase only adds
behavior, not schema.
"""
import uuid

from django.conf import settings
from django.db import models


class Visibility(models.TextChoices):
    PUBLIC = "public", "Public"
    PRIVATE = "private", "Private"


class ProcessingStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSED = "processed", "Processed"
    FAILED = "failed", "Failed"


class Document(models.Model):
    """One row per uploaded file. `object_key` is the randomized storage
    path (never derived from the original filename — docs/SECURITY.md
    "File uploads"); `original_filename` is kept as metadata only."""

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    object_key = models.CharField(max_length=512, unique=True)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=150)
    size_bytes = models.PositiveBigIntegerField()
    checksum = models.CharField(max_length=64, blank=True, help_text="SHA-256 of the uploaded content.")

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents"
    )
    visibility = models.CharField(max_length=10, choices=Visibility.choices, default=Visibility.PRIVATE)
    status = models.CharField(max_length=10, choices=ProcessingStatus.choices, default=ProcessingStatus.PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "documents_document"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["visibility", "status"])]

    def __str__(self) -> str:
        return self.original_filename


class DownloadLog(models.Model):
    """Written on every authorized access to a private document
    (docs/SECURITY.md, docs/FILE_STORAGE.md "Private file access") —
    required, not optional, for private files."""

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="download_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    downloaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "documents_downloadlog"
        ordering = ["-downloaded_at"]
        indexes = [models.Index(fields=["document", "-downloaded_at"])]

    def __str__(self) -> str:
        return f"{self.document_id} @ {self.downloaded_at:%Y-%m-%d %H:%M}"
