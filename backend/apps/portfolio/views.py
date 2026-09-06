"""
Portfolio API (docs/API_DESIGN.md, spec §12).

Public — no auth, PUBLISHED projects only, always paginated + filtered:
    GET /api/v1/portfolio/                ?country= ?service= ?industry= ?year= ?featured= ?q=
    GET /api/v1/portfolio/{slug}/

Admin — session auth + `portfolio.*_project` permissions:
    /api/v1/admin/portfolio/             CRUD + transition/ + versions/ + rollback
"""
from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from apps.pages.api_mixins import (
    VersionedViewSetMixin,
    WorkflowViewSetMixin,
    crud_perms,
    workflow_perms,
)
from apps.pages.models import PublishStatus
from apps.pages.response_cache import CachedPublicReadMixin
from apps.permissions.permissions import HasRequiredPermissions

from .filters import ProjectFilter
from .models import Project
from .serializers import (
    ProjectAdminSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
)

_DETAIL_PREFETCH = ("services", "technology", "images__image__document", "documents__document")


class ProjectViewSet(CachedPublicReadMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    filterset_class = ProjectFilter
    cache_namespace = "portfolio"

    def get_queryset(self):
        qs = Project.objects.filter(status=PublishStatus.PUBLISHED).select_related(
            "country", "client_industry", "og_image__document"
        )
        if self.action == "retrieve":
            return qs.prefetch_related(*_DETAIL_PREFETCH)
        return qs.prefetch_related("images__image__document").distinct()

    def get_serializer_class(self):
        return ProjectDetailSerializer if self.action == "retrieve" else ProjectListSerializer


class ProjectAdminViewSet(
    WorkflowViewSetMixin, VersionedViewSetMixin, viewsets.ModelViewSet
):
    queryset = Project.objects.select_related(
        "country", "client_industry", "og_image"
    ).prefetch_related("services", "technology", "images__image")
    serializer_class = ProjectAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["status", "is_featured"]
    required_permissions_map = {
        **crud_perms("portfolio", "project"),
        **workflow_perms("portfolio", "project"),
    }
