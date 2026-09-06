"""
CMS API serializers (docs/API_DESIGN.md). Rich text / rich-text-bearing
JSON is sanitised on the way in (`apps.pages.sanitize`); workflow fields
(`status`, `published_at`, `current_version`) are read-only here and only
change through the `transition` action.
"""
from __future__ import annotations

from django.utils.html import strip_tags
from rest_framework import serializers

from .models import ContentVersion, PageSection, PublishStatus, Redirect, SiteSetting, Tag
from .sanitize import sanitize_html, sanitize_json_html


class SanitizedHTMLField(serializers.CharField):
    """A text field whose value is run through the allow-list HTML
    sanitiser on input. Reusable by every content model with a rich-text
    field in later phases."""

    def to_internal_value(self, data):
        return sanitize_html(super().to_internal_value(data))


class PlainTextField(serializers.CharField):
    """A text field that accepts no markup at all — every tag is stripped
    on input. For public free-text that is only ever rendered as plain
    text (career cover letters, quote / contact messages); a stored
    ``<script>`` must never reach a future admin renderer."""

    def to_internal_value(self, data):
        return strip_tags(super().to_internal_value(data)).strip()


class MediaRefSerializer(serializers.Serializer):
    """Lightweight image reference shared by every content API. `url` is
    a stable signed URL to the underlying public file (Phase 10); it is
    `null` while the upload is still being scanned, so clients must still
    render gracefully from `alt_text` / dimensions."""

    id = serializers.IntegerField()
    url = serializers.SerializerMethodField()
    alt_text = serializers.CharField()
    caption = serializers.CharField()
    width = serializers.IntegerField(allow_null=True)
    height = serializers.IntegerField(allow_null=True)

    def get_url(self, obj) -> str | None:
        from apps.documents.services import public_url

        document = getattr(obj, "document", None)
        return public_url(document)


class NamedSlugRefSerializer(serializers.Serializer):
    """`{id, name, slug}` — for referencing a related catalogue object
    (Service, Industry, Technology, Tag) from another model's payload
    without embedding its full record."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.SlugField()


class WorkflowStatusMixin(serializers.Serializer):
    """Adds a read-only `allowed_transitions` to any admin serializer for
    a model with a `status` — the admin UI's `WorkflowBar` renders one
    button per entry instead of hardcoding the graph
    (`apps.pages.workflow`)."""

    allowed_transitions = serializers.SerializerMethodField()

    def get_allowed_transitions(self, obj) -> list[str]:
        from .workflow import allowed_targets

        return sorted(allowed_targets(getattr(obj, "status", "") or ""))


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class PageSectionSerializer(WorkflowStatusMixin, serializers.ModelSerializer):
    updated_by_email = serializers.EmailField(source="updated_by.email", read_only=True)

    class Meta:
        model = PageSection
        fields = [
            "id",
            "page_key",
            "section_key",
            "display_order",
            "content",
            "status",
            "allowed_transitions",
            "published_at",
            "scheduled_publish_at",
            "current_version",
            "updated_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "published_at",
            "current_version",
            "updated_by_email",
            "created_at",
            "updated_at",
        ]

    def validate_content(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("content must be a JSON object.")
        return sanitize_json_html(value)


class SiteSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ["id", "key", "value", "value_type", "description"]


class RedirectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Redirect
        fields = ["id", "old_path", "new_path", "is_permanent", "note", "created_at"]
        read_only_fields = ["created_at"]


class ContentVersionSerializer(serializers.ModelSerializer):
    edited_by_email = serializers.EmailField(source="edited_by.email", read_only=True)
    note = serializers.SerializerMethodField()

    class Meta:
        model = ContentVersion
        fields = ["id", "snapshot", "note", "edited_by_email", "edited_at"]

    def get_note(self, obj) -> str:
        return (obj.snapshot or {}).get("__note__", "")


class TransitionSerializer(serializers.Serializer):
    to = serializers.ChoiceField(choices=PublishStatus.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class PublicPageSectionSerializer(serializers.ModelSerializer):
    """The read-only shape the public site consumes — no workflow/audit
    fields, only what renders."""

    class Meta:
        model = PageSection
        fields = ["section_key", "display_order", "content", "published_at"]
