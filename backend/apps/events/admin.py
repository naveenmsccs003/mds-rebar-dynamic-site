from django.contrib import admin

from apps.pages.admin import PublishableContentAdmin

from .models import Event


@admin.register(Event)
class EventAdmin(PublishableContentAdmin):
    list_display = PublishableContentAdmin.list_display + ("event_start", "location")
