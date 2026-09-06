from django.db import models

from apps.media.models import MediaAsset


class Technology(models.Model):
    """Software/technology platforms MDS Rebar uses (spec §9/§22 "Technology"
    section + service `technology` M2M). No entries are fabricated — this
    starts empty and is populated by admins."""

    name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    logo = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    display_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = "technology_technology"
        ordering = ["display_order", "name"]
        verbose_name_plural = "technologies"

    def __str__(self) -> str:
        return self.name
