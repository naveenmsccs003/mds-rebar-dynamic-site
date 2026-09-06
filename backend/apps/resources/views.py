"""
Resource API (docs/API_DESIGN.md, spec §13).

Public — no auth, published only:
    GET /api/v1/resources/               ?category= ?access_type= ?q=
    GET /api/v1/resources/{slug}/

Admin — session auth + `resources.*_resource` permissions:
    /api/v1/admin/resources/             CRUD (plain — no publishing workflow)
"""
from __future__ import annotations

from django.db.models import F, Q
from django.http import Http404
from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny

from apps.documents import services as documents
from apps.documents.exceptions import FileNotReady
from apps.pages.api_mixins import crud_perms
from apps.permissions.permissions import HasRequiredPermissions
from config.api_responses import ok

from .models import AccessType, Resource
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

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, slug=None):
        """Issue a signed URL for the resource's file and count the
        download through this authorized path (never a client-reported
        event — docs/FILE_STORAGE.md "Restricted resources"). A
        `restricted` resource needs a signed-in Knowledge Base account
        (`resources.view_resource`); a `public` one is open.
        """
        resource = self.get_object()
        if not resource.file_id:
            raise Http404
        if resource.access_type == AccessType.RESTRICTED and not (
            request.user.is_authenticated and request.user.has_perm("resources.view_resource")
        ):
            raise PermissionDenied("This resource requires a Knowledge Base account.")

        try:
            payload = documents.issue_download(
                resource.file, user=request.user, request=request, skip_authz=True
            )
        except documents.DownloadNotReady:
            raise FileNotReady() from None

        Resource.objects.filter(pk=resource.pk).update(download_count=F("download_count") + 1)
        return ok(payload)


class ResourceAdminViewSet(viewsets.ModelViewSet):
    queryset = Resource.objects.select_related("thumbnail", "file")
    serializer_class = ResourceAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["category", "access_type", "is_published"]
    required_permissions_map = crud_perms("resources", "resource")
