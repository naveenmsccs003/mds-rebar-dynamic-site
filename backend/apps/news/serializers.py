"""
News API serializers (docs/API_DESIGN.md, spec §14). News extends the
shared `PublishableContent` base, so Blogs / Events / CSR get the same
serializer shape in Phase 7-later work.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.pages.models import Tag
from apps.pages.serializers import (
    MediaRefSerializer,
    NamedSlugRefSerializer,
    SanitizedHTMLField,
    WorkflowStatusMixin,
)

from .models import News


class NewsListSerializer(serializers.ModelSerializer):
    featured_image = MediaRefSerializer(read_only=True)
    tags = NamedSlugRefSerializer(many=True, read_only=True)

    class Meta:
        model = News
        fields = [
            "id", "title", "slug", "summary", "category", "publish_date",
            "featured_image", "tags",
        ]


class NewsDetailSerializer(NewsListSerializer):
    author_name = serializers.SerializerMethodField()
    og_image = MediaRefSerializer(read_only=True)

    class Meta(NewsListSerializer.Meta):
        fields = NewsListSerializer.Meta.fields + [
            "content", "author_name",
            "seo_title", "seo_description", "seo_keywords",
            "og_title", "og_description", "og_image", "canonical_url",
            "updated_at",
        ]

    def get_author_name(self, obj) -> str:
        return obj.author.get_full_name() if obj.author_id else ""


class NewsAdminSerializer(WorkflowStatusMixin, serializers.ModelSerializer):
    content = SanitizedHTMLField(required=False, allow_blank=True)
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Tag.objects.all(), required=False
    )
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = News
        fields = [
            "id", "title", "slug", "summary", "content", "category",
            "featured_image", "tags", "author", "author_name",
            "publish_date", "scheduled_publish_at", "status", "allowed_transitions",
            "seo_title", "seo_description", "seo_keywords",
            "og_title", "og_description", "og_image", "canonical_url",
            "created_at", "updated_at",
        ]
        read_only_fields = ["allowed_transitions", "status", "author", "created_at", "updated_at"]

    def get_author_name(self, obj) -> str:
        return obj.author.get_full_name() if obj.author_id else ""

    def create(self, validated_data):
        request = self.context.get("request")
        if request is not None and validated_data.get("author") is None:
            validated_data["author"] = request.user
        return super().create(validated_data)
