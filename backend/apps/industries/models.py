from django.db import models

from apps.media.models import MediaAsset


class Industry(models.Model):
    name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(blank=True)
    icon = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    display_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = "industries_industry"
        ordering = ["display_order", "name"]
        verbose_name_plural = "industries"

    def __str__(self) -> str:
        return self.name
