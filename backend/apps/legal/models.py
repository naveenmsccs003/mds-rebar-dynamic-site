"""
Legal pages (spec §7 footer nav: Privacy Policy, Terms & Conditions,
NDA/Confidentiality, Data Security & Compliance) — CMS-editable, version
tracked via `pages.ContentVersion` like any other published content.
"""
from django.conf import settings
from django.db import models


class LegalDocumentType(models.TextChoices):
    PRIVACY_POLICY = "privacy_policy", "Privacy Policy"
    TERMS = "terms", "Terms & Conditions"
    NDA = "nda", "NDA / Confidentiality"
    DATA_SECURITY = "data_security", "Data Security & Compliance"


class LegalDocument(models.Model):
    document_type = models.CharField(max_length=20, choices=LegalDocumentType.choices, unique=True)
    title = models.CharField(max_length=150)
    content = models.TextField(blank=True, help_text="Sanitized HTML (docs/SECURITY.md).")
    version = models.PositiveIntegerField(default=1)
    effective_date = models.DateField(null=True, blank=True)
    is_published = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "legal_legaldocument"
        ordering = ["document_type"]
        permissions = [("publish_legaldocument", "Can publish legal document")]

    def __str__(self) -> str:
        return self.title
