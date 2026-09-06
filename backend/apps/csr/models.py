from django.db import models

from apps.pages.models import PublishableContent


class CSRPost(PublishableContent):
    focus_area = models.CharField(max_length=150, blank=True, help_text="e.g. 'Sustainability', 'Community'.")

    class Meta(PublishableContent.Meta):
        db_table = "csr_csrpost"
        verbose_name = "CSR Post"
        verbose_name_plural = "CSR Posts"
        permissions = [("publish_csrpost", "Can publish CSR post")]
