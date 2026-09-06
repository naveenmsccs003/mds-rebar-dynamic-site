from django.contrib import admin, messages

from . import workflow
from .models import ContentVersion, PageSection, PublishStatus, Redirect, SiteSetting, Tag


class PublishableContentAdmin(admin.ModelAdmin):
    """Shared admin config for News/Blog/Event/CSR (all extend
    `PublishableContent`) — one definition instead of four near-identical
    ModelAdmins (spec §56 avoid duplication)."""

    list_display = ("title", "status", "author", "publish_date")
    list_filter = ("status",)
    search_fields = ("title", "summary")
    prepopulated_fields = {"slug": ("title",)}
    filter_horizontal = ("tags",)


def _bulk_transition(modeladmin, request, queryset, target):
    done, skipped = 0, 0
    for obj in queryset:
        if workflow.can_transition(request.user, obj, target):
            workflow.transition(obj, target, user=request.user, request=request, note="admin bulk action")
            done += 1
        else:
            skipped += 1
    modeladmin.message_user(
        request,
        f"{done} section(s) moved to {target}; {skipped} skipped "
        f"(not a legal transition or missing permission).",
        level=messages.SUCCESS if done else messages.WARNING,
    )


@admin.register(PageSection)
class PageSectionAdmin(admin.ModelAdmin):
    list_display = ("page_key", "section_key", "status", "display_order", "published_at", "updated_at")
    list_filter = ("page_key", "status")
    search_fields = ("page_key", "section_key")
    readonly_fields = ("status", "published_at", "current_version", "created_at", "updated_at")

    @admin.action(description="Submit selected sections for review")
    def submit_for_review(self, request, queryset):
        _bulk_transition(self, request, queryset, PublishStatus.REVIEW)

    @admin.action(description="Publish selected sections")
    def publish(self, request, queryset):
        _bulk_transition(self, request, queryset, PublishStatus.PUBLISHED)

    @admin.action(description="Archive selected sections")
    def archive(self, request, queryset):
        _bulk_transition(self, request, queryset, PublishStatus.ARCHIVED)

    actions = ["submit_for_review", "publish", "archive"]


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value_type", "value")
    search_fields = ("key",)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Redirect)
class RedirectAdmin(admin.ModelAdmin):
    list_display = ("old_path", "new_path", "is_permanent", "created_at")
    search_fields = ("old_path", "new_path")
    list_filter = ("is_permanent",)


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
