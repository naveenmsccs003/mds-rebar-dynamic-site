from django.contrib import admin

from .models import ContentVersion, PageSection, SiteSetting, Tag


class PublishableContentAdmin(admin.ModelAdmin):
    """Shared admin config for News/Blog/Event/CSR (all extend
    `PublishableContent`) — one definition instead of four near-identical
    ModelAdmins (spec §56 avoid duplication)."""

    list_display = ("title", "status", "author", "publish_date")
    list_filter = ("status",)
    search_fields = ("title", "summary")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("tags",)


@admin.register(PageSection)
class PageSectionAdmin(admin.ModelAdmin):
    list_display = ("page_key", "section_key", "status", "display_order", "updated_at")
    list_filter = ("page_key", "status")
    search_fields = ("page_key", "section_key")


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value_type", "value")
    search_fields = ("key",)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ContentVersion)
class ContentVersionAdmin(admin.ModelAdmin):
    """Read-only — version history is written by the application, never
    hand-edited (spec §23/§72 rollback safety)."""

    list_display = ("content_type", "object_id", "edited_by", "edited_at")
    list_filter = ("content_type",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
