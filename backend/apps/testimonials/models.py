from django.db import models

from apps.media.models import MediaAsset


class Testimonial(models.Model):
    """Homepage/portfolio testimonials (spec §8/§22). Never fabricated —
    starts empty; each entry is entered and attributed by an admin."""

    author_name = models.CharField(max_length=150)
    author_role = models.CharField(max_length=150, blank=True)
    author_company = models.CharField(max_length=150, blank=True)
    author_photo = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    quote = models.TextField()
    display_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "testimonials_testimonial"
        ordering = ["display_order", "-created_at"]

    def __str__(self) -> str:
        return f"{self.author_name} ({self.author_company})" if self.author_company else self.author_name
