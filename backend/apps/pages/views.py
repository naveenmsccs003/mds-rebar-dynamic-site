"""
CMS API (docs/API_DESIGN.md).

Admin surface — session auth + per-action Django permissions
(`apps.permissions.HasRequiredPermissions`), mounted at
``/api/v1/admin/cms/``:

    sections/           PageSection CRUD (drafts)
    sections/{id}/transition/            publishing-workflow move
    sections/{id}/versions/             version history
    sections/{id}/versions/{vid}/rollback/
    settings/           SiteSetting CRUD (cache-invalidating)
    tags/               Tag CRUD
    redirects/          Redirect CRUD

Public surface — no auth, read-only, published content only:

    GET /api/v1/pages/{page_key}/
"""
from __future__ import annotations

from rest_framework import viewsets
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from apps.permissions.permissions import HasRequiredPermissions

from .api_mixins import (
    VersionedViewSetMixin,
    WorkflowViewSetMixin,
    crud_perms,
    workflow_perms,
)
from .models import PageSection, PublishStatus, Redirect, SiteSetting, Tag
from .serializers import (
    PageSectionSerializer,
    PublicPageSectionSerializer,
    RedirectSerializer,
    SiteSettingSerializer,
    TagSerializer,
)


class PageSectionViewSet(WorkflowViewSetMixin, VersionedViewSetMixin, viewsets.ModelViewSet):
    queryset = PageSection.objects.select_related("updated_by", "current_version").all()
    serializer_class = PageSectionSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["page_key", "status"]
    required_permissions_map = {
        **crud_perms("pages", "pagesection"),
        **workflow_perms("pages", "pagesection"),
    }


class SiteSettingViewSet(viewsets.ModelViewSet):
    queryset = SiteSetting.objects.all()
    serializer_class = SiteSettingSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["value_type"]
    required_permissions_map = crud_perms("pages", "sitesetting")
    # Cache invalidation is handled by the post_save/post_delete signals
    # wired in apps.pages.apps.PagesConfig.ready().


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [HasRequiredPermissions]
    required_permissions_map = crud_perms("pages", "tag")


class RedirectViewSet(viewsets.ModelViewSet):
    queryset = Redirect.objects.all()
    serializer_class = RedirectSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["is_permanent"]
    required_permissions_map = crud_perms("pages", "redirect")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PublicPageView(ListAPIView):
    """Published sections for one page, ordered — what the public site
    renders (Phase 5 wires the React pages to this)."""

    serializer_class = PublicPageSectionSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    queryset = PageSection.objects.none()  # real filter is in get_queryset

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PageSection.objects.none()
        return PageSection.objects.filter(
            page_key=self.kwargs["page_key"], status=PublishStatus.PUBLISHED
        ).order_by("display_order")
