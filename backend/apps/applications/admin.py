from django.contrib import admin

from .models import JobApplication


@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    """Resume access still goes through the authorized signed-URL path
    (docs/FILE_STORAGE.md) once Phase 10 builds it — this list view does
    not expose a direct download link."""

    list_display = ("name", "job", "status", "created_at")
    list_filter = ("status", "job")
    search_fields = ("name", "email")
    readonly_fields = ("ip_address", "user_agent", "created_at")
