"""
Resources (spec §13): brochures, videos, sample drawings, technical
docs, case studies, whitepapers. Restricted resources resolve to a
signed URL at request time (Phase 10) rather than a static link — the
`access_type` field here just records the policy.
"""
from django.db import models

from apps.documents.models import Document
from apps.media.models import MediaAsset


class ResourceCategory(models.TextChoices):
    BROCHURE = "brochure", "Brochure"
    VIDEO = "video", "Video"
    SAMPLE_DRAWING = "sample_drawing", "Sample Drawing"
    TECHNICAL_DOCUMENT = "technical_document", "Technical Document"
    CASE_STUDY = "case_study", "Case Study"
    WHITEPAPER = "whitepaper", "Whitepaper"


class AccessType(models.TextChoices):
    PUBLIC = "public", "Public"
    RESTRICTED = "restricted", "Restricted"


class Resource(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=30, choices=ResourceCategory.choices)

    file = models.ForeignKey(Document, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    thumbnail = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    external_url = models.URLField(blank=True)

    access_type = models.CharField(max_length=10, choices=AccessType.choices, default=AccessType.PUBLIC)
    published_date = models.DateField(null=True, blank=True)
    download_count = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)

    seo_title = models.CharField(max_length=70, blank=True)
    seo_description = models.CharField(max_length=160, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "resources_resource"
        ordering = ["-published_date"]
        indexes = [models.Index(fields=["is_published", "category"])]

    def __str__(self) -> str:
        return self.title
