from django.contrib import admin

from .models import DownloadLog, Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "content_type", "visibility", "status", "owner", "created_at")
    list_filter = ("visibility", "status")
    search_fields = ("original_filename", "object_key")
    readonly_fields = ("uuid", "object_key", "checksum", "created_at", "updated_at")


@admin.register(DownloadLog)
class DownloadLogAdmin(admin.ModelAdmin):
    """Read-only — written automatically on every authorized private-file
    access (docs/FILE_STORAGE.md), never hand-entered."""

    list_display = ("document", "user", "ip_address", "downloaded_at")
    search_fields = ("document__original_filename",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
