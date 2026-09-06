from django.db import models

from apps.pages.models import PublishableContent


class Blog(PublishableContent):
    category = models.CharField(max_length=100, blank=True)

    class Meta(PublishableContent.Meta):
        db_table = "blogs_blog"
        permissions = [("publish_blog", "Can publish blog")]
