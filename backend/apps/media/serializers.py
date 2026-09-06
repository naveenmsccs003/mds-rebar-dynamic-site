"""
Media API serializers (docs/API_DESIGN.md, docs/FILE_STORAGE.md).

A `MediaAsset` is display metadata (alt text, caption, dimensions)
wrapped around a *public*, already-uploaded `documents.Document`. The
file itself goes through the Phase 10 upload flow
(`POST /api/v1/admin/documents/upload/` with `category=image`,
`visibility=public`); this serializer just links the two and exposes the
resolved URL.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.documents.models import Document, Visibility
from apps.documents.services import public_url as resolved_media_url

from .models import MediaAsset


class MediaAssetAdminSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    document_status = serializers.CharField(source="document.status", read_only=True)

    class Meta:
        model = MediaAsset
        fields = [
            "id", "document", "document_status", "url",
            "alt_text", "caption", "width", "height", "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_url(self, obj) -> str | None:
        return resolved_media_url(obj.document)

    def validate_document(self, document: Document) -> Document:
        if document.visibility != Visibility.PUBLIC:
            raise serializers.ValidationError("A media asset must wrap a public document.")
        if hasattr(document, "media_asset") and (
            self.instance is None or self.instance.pk != document.media_asset.pk
        ):
            raise serializers.ValidationError("This document already has a media asset.")
        return document
