"""
Media asset admin API (docs/API_DESIGN.md).

    /api/v1/admin/media/     CRUD, gated by `media.*_mediaasset`

There is no public media list endpoint — media assets are referenced
(with their resolved `url`) from the content APIs that use them
(services, portfolio, news, resources).
"""
from __future__ import annotations

from rest_framework import viewsets

from apps.pages.api_mixins import crud_perms
from apps.permissions.permissions import HasRequiredPermissions

from .models import MediaAsset
from .serializers import MediaAssetAdminSerializer


class MediaAssetAdminViewSet(viewsets.ModelViewSet):
    queryset = MediaAsset.objects.select_related("document")
    serializer_class = MediaAssetAdminSerializer
    permission_classes = [HasRequiredPermissions]
    required_permissions_map = crud_perms("media", "mediaasset")
