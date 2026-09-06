from django.db import models

from apps.media.models import MediaAsset


class Client(models.Model):
    """Client logos for the homepage trust section (spec §8/§22). Never
    seeded with fabricated names — starts empty (spec §2/§84)."""

    name = models.CharField(max_length=150, unique=True)
    logo = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    website_url = models.URLField(blank=True)
    display_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = "clients_client"
        ordering = ["display_order", "name"]

    def __str__(self) -> str:
        return self.name
