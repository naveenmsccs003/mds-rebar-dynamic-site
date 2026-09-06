"""
Service API (docs/API_DESIGN.md).

Public — no auth, published services only:
    GET /api/v1/services/                 (paginated, ?technology=<slug>, ?q=)
    GET /api/v1/services/{slug}/

Admin — session auth + `services.*_service` permissions:
    /api/v1/admin/services/               CRUD
    /api/v1/admin/services/{id}/transition/            publishing workflow
    /api/v1/admin/services/{id}/versions/              version history
    /api/v1/admin/services/{id}/versions/{vid}/rollback/
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
from apps.permissions.permissions import HasRequiredPermissions

from .filters import ServiceFilter
from .models import Service
from .serializers import (
    ServiceAdminSerializer,
    ServiceDetailSerializer,
    ServiceListSerializer,
)

_CHILD_PREFETCH = ("capabilities", "process_steps", "faqs", "technology")


class ServiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Public catalogue. Only PUBLISHED services are ever visible."""

    permission_classes = [AllowAny]
    lookup_field = "slug"
    filterset_class = ServiceFilter

    def get_queryset(self):
        qs = Service.objects.filter(status=PublishStatus.PUBLISHED)
        if self.action == "retrieve":
            return qs.select_related("hero_image", "icon", "og_image").prefetch_related(
                *_CHILD_PREFETCH
            )
        return qs.select_related("hero_image", "icon")

    def get_serializer_class(self):
        return ServiceDetailSerializer if self.action == "retrieve" else ServiceListSerializer


class ServiceAdminViewSet(
    WorkflowViewSetMixin, VersionedViewSetMixin, viewsets.ModelViewSet
):
    queryset = Service.objects.select_related(
        "hero_image", "icon", "og_image"
    ).prefetch_related(*_CHILD_PREFETCH)
    serializer_class = ServiceAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["status"]
    required_permissions_map = {
        **crud_perms("services", "service"),
        **workflow_perms("services", "service"),
    }
