from django.contrib import admin

from .models import NotificationLog


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    """Read-mostly — records are written by the notification-sending
    task (Phase 9+), not hand-authored."""

    list_display = ("channel", "recipient", "template", "status", "attempts", "created_at")
    list_filter = ("status", "channel")
    search_fields = ("recipient", "template")

    def has_add_permission(self, request):
        return False
