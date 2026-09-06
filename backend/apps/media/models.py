"""
Presentational wrapper around a `documents.Document` for images/video
used *within* content (hero images, galleries, OG images) — carries the
accessibility/display metadata (alt text, caption, dimensions) that a
bare file record shouldn't have to. Downloadable files with access
control (resumes, brochures) use `documents.Document` directly instead.
"""
from django.db import models

from apps.documents.models import Document


class MediaAsset(models.Model):
    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name="media_asset")
    alt_text = models.CharField(
        max_length=255, blank=True, help_text="Required for published use (docs/UI_DESIGN_SYSTEM.md accessibility)."
    )
    caption = models.CharField(max_length=255, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "media_mediaasset"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.alt_text or self.document.original_filename
