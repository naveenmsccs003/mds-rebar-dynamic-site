"""
Job applications (spec §16). Resume handling follows docs/FILE_STORAGE.md
/ docs/SECURITY.md: private storage, randomized object name via the
related `documents.Document`, no trust in client-supplied filename/MIME.
The actual upload/validation pipeline is Phase 10 — this model only
records the resulting metadata.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.careers.models import JobPosting
from apps.documents.models import Document


class ApplicationStatus(models.TextChoices):
    NEW = "new", "New"
    REVIEWING = "reviewing", "Reviewing"
    SHORTLISTED = "shortlisted", "Shortlisted"
    REJECTED = "rejected", "Rejected"
    HIRED = "hired", "Hired"


class JobApplication(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    job = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name="applications")

    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    resume = models.ForeignKey(Document, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    cover_letter = models.TextField(blank=True)
    additional_info = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=ApplicationStatus.choices, default=ApplicationStatus.NEW)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "applications_jobapplication"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.name} -> {self.job.title}"
