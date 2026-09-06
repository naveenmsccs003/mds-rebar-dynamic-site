from django.contrib import admin

from .models import JobApplication


@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    """Resume access still goes through the authorized signed-URL path
    (docs/FILE_STORAGE.md) once Phase 10 builds it — this list view does
    not expose a direct download link. Everything the applicant
    submitted is read-only; only `status` / `assigned_to` are editable,
    matching the API."""

    list_display = ("name", "job", "status", "assigned_to", "created_at")
    list_filter = ("status", "job")
    search_fields = ("name", "email")
    autocomplete_fields = ("job", "assigned_to")
    readonly_fields = (
        "uuid", "job", "name", "email", "phone", "resume", "cover_letter",
        "additional_info", "idempotency_key", "ip_address", "user_agent", "created_at",
    )
