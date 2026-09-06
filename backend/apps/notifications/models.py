"""
Notification delivery log (spec §32/§69): a failed email must be logged
and retried, never allowed to crash the request that triggered it. The
actual sending happens in Celery tasks (Phase 9+); this model just
tracks outcome so failures are visible and retryable.
"""
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class NotificationStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


class NotificationLog(models.Model):
    channel = models.CharField(max_length=30, default="email")
    recipient = models.CharField(max_length=255)
    template = models.CharField(max_length=150)

    related_content_type = models.ForeignKey(ContentType, null=True, blank=True, on_delete=models.SET_NULL)
    related_object_id = models.PositiveBigIntegerField(null=True, blank=True)
    related_object = GenericForeignKey("related_content_type", "related_object_id")

    status = models.CharField(max_length=10, choices=NotificationStatus.choices, default=NotificationStatus.QUEUED)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notifications_notificationlog"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.channel}:{self.recipient} ({self.status})"
