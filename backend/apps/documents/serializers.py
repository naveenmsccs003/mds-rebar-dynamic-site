"""Document API serializers (docs/API_DESIGN.md, docs/FILE_STORAGE.md)."""
from __future__ import annotations

from rest_framework import serializers

from .models import Document, Visibility


class UploadRequestSerializer(serializers.Serializer):
    """Body of `POST /api/v1/admin/documents/upload/` — a *declared*
    upload; the bytes follow via the returned ticket."""

    category = serializers.ChoiceField(choices=["resume", "document", "image"])
    filename = serializers.CharField(max_length=255)
    size = serializers.IntegerField(min_value=1)
    content_type = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    visibility = serializers.ChoiceField(
        choices=Visibility.choices, required=False, default=Visibility.PRIVATE
    )


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            "uuid", "original_filename", "content_type", "size_bytes", "checksum",
            "visibility", "status", "created_at", "updated_at",
        ]
        read_only_fields = fields
