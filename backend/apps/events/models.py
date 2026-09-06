from django.db import models

from apps.pages.models import PublishableContent


class Event(PublishableContent):
    event_start = models.DateTimeField(null=True, blank=True)
    event_end = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)

    class Meta(PublishableContent.Meta):
        db_table = "events_event"
        permissions = [("publish_event", "Can publish event")]
