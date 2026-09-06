"""
Resource API serializers (docs/API_DESIGN.md, spec §13).

Resources are a file catalogue, not editorial prose — they use a plain
`is_published` boolean (no DRAFT/REVIEW workflow, no version history).
The actual file link for a `restricted` resource is a short-lived signed
URL resolved at request time in Phase 10; here the response only carries
the policy (`access_type`) and metadata.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.pages.serializers import MediaRefSerializer

from .models import Resource


class ResourceListSerializer(serializers.ModelSerializer):
    thumbnail = MediaRefSerializer(read_only=True)

    class Meta:
        model = Resource
        fields = [
            "id", "title", "slug", "description", "category", "access_type",
            "published_date", "external_url", "thumbnail",
        ]


class ResourceDetailSerializer(ResourceListSerializer):
    has_file = serializers.SerializerMethodField()

    class Meta(ResourceListSerializer.Meta):
        fields = ResourceListSerializer.Meta.fields + [
            "download_count", "has_file", "seo_title", "seo_description", "updated_at",
        ]

    def get_has_file(self, obj) -> bool:
        return obj.file_id is not None


class ResourceAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = [
            "id", "title", "slug", "description", "category",
            "file", "thumbnail", "external_url",
            "access_type", "published_date", "is_published",
            "download_count", "seo_title", "seo_description",
            "created_at", "updated_at",
        ]
        read_only_fields = ["download_count", "created_at", "updated_at"]
