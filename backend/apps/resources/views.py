"""
Resource API (docs/API_DESIGN.md, spec §13).

Public — no auth, published only:
    GET /api/v1/resources/               ?category= ?access_type= ?q=
    GET /api/v1/resources/{slug}/

Admin — session auth + `resources.*_resource` permissions:
    /api/v1/admin/resources/             CRUD (plain — no publishing workflow)
"""
from __future__ import annotations

from django.db.models import Q
from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from apps.pages.api_mixins import crud_perms
from apps.permissions.permissions import HasRequiredPermissions

from .models import Resource
from .serializers import (
    ResourceAdminSerializer,
    ResourceDetailSerializer,
    ResourceListSerializer,
)


class ResourceFilter(filters.FilterSet):
    q = filters.CharFilter(method="search")

    class Meta:
        model = Resource
        fields = ["category", "access_type", "q"]

    def search(self, queryset, name, value):
        return queryset.filter(Q(title__icontains=value) | Q(description__icontains=value))


class ResourceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    filterset_class = ResourceFilter

    def get_queryset(self):
        return Resource.objects.filter(is_published=True).select_related("thumbnail", "file")

    def get_serializer_class(self):
        return ResourceDetailSerializer if self.action == "retrieve" else ResourceListSerializer


class ResourceAdminViewSet(viewsets.ModelViewSet):
    queryset = Resource.objects.select_related("thumbnail", "file")
    serializer_class = ResourceAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["category", "access_type", "is_published"]
    required_permissions_map = crud_perms("resources", "resource")
