"""
Portfolio (spec §12): server-filtered, paginated — the full table must
never be loaded into the browser (enforced at the API/view layer in
Phase 7; the indexes here exist to make that filtering fast).
"""
from django.db import models

from apps.documents.models import Document
from apps.industries.models import Industry
from apps.markets.models import Country
from apps.media.models import MediaAsset
from apps.pages.models import PublishStatus
from apps.services.models import Service
from apps.technology.models import Technology


class Project(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)

    client_industry = models.ForeignKey(
        Industry, null=True, blank=True, on_delete=models.SET_NULL, related_name="projects"
    )
    country = models.ForeignKey(Country, null=True, blank=True, on_delete=models.SET_NULL, related_name="projects")
    category = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True, help_text="Sanitized HTML (docs/SECURITY.md).")

    services = models.ManyToManyField(Service, blank=True, related_name="projects")
    technology = models.ManyToManyField(Technology, blank=True, related_name="projects")

    completion_year = models.PositiveIntegerField(null=True, blank=True)
    is_featured = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.DRAFT)

    seo_title = models.CharField(max_length=70, blank=True)
    seo_description = models.CharField(max_length=160, blank=True)
    og_image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "portfolio_project"
        ordering = ["-completion_year", "title"]
        permissions = [("publish_project", "Can publish project")]
        indexes = [
            models.Index(fields=["status", "country"]),
            models.Index(fields=["status", "is_featured"]),
            models.Index(fields=["status", "completion_year"]),
        ]

    def __str__(self) -> str:
        return self.title


class ProjectImage(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="images")
    image = models.ForeignKey(MediaAsset, on_delete=models.CASCADE, related_name="+")
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "portfolio_projectimage"
        ordering = ["display_order"]


class ProjectDocument(models.Model):
    """Only documents explicitly allowed for public/client viewing (spec
    §12 "Allowed Documents") attach here — access still goes through the
    normal Document visibility + signed-URL path (docs/FILE_STORAGE.md)."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="documents")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="+")
    label = models.CharField(max_length=150, blank=True)
    is_public = models.BooleanField(default=False)

    class Meta:
        db_table = "portfolio_projectdocument"
