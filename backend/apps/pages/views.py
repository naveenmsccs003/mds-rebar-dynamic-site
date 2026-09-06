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

from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from apps.permissions.permissions import HasRequiredPermissions

from . import workflow
from .exceptions import InvalidTransition
from .models import PageSection, PublishStatus, Redirect, SiteSetting, Tag
from .serializers import (
    ContentVersionSerializer,
    PageSectionSerializer,
    PublicPageSectionSerializer,
    RedirectSerializer,
    SiteSettingSerializer,
    TagSerializer,
    TransitionSerializer,
)
from .versioning import rollback, snapshot, versions_for


def _crud_perms(app_label: str, model: str) -> dict[str, list[str]]:
    return {
        "list": [f"{app_label}.view_{model}"],
        "retrieve": [f"{app_label}.view_{model}"],
        "create": [f"{app_label}.add_{model}"],
        "update": [f"{app_label}.change_{model}"],
        "partial_update": [f"{app_label}.change_{model}"],
        "destroy": [f"{app_label}.delete_{model}"],
    }


class PageSectionViewSet(viewsets.ModelViewSet):
    queryset = PageSection.objects.select_related("updated_by", "current_version").all()
    serializer_class = PageSectionSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["page_key", "status"]
    required_permissions_map = {
        **_crud_perms("pages", "pagesection"),
        "versions": ["pages.view_pagesection"],
        "transition": ["pages.change_pagesection"],  # publish target re-checked below
        "rollback": ["pages.change_pagesection"],
    }

    def perform_create(self, serializer):
        obj = serializer.save(updated_by=self.request.user)
        version = snapshot(obj, user=self.request.user, note="created")
        PageSection.objects.filter(pk=obj.pk).update(current_version=version)

    def perform_update(self, serializer):
        obj = serializer.save(updated_by=self.request.user)
        version = snapshot(obj, user=self.request.user, note="edited")
        PageSection.objects.filter(pk=obj.pk).update(current_version=version)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        obj = self.get_object()
        payload = TransitionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        target = payload.validated_data["to"]
        note = payload.validated_data.get("note", "")

        if target not in workflow.allowed_targets(obj.status):
            raise InvalidTransition(
                f"Cannot move from '{obj.status}' to '{target}'. "
                f"Allowed: {sorted(workflow.allowed_targets(obj.status)) or 'none'}."
            )
        required = workflow.required_permission(PageSection, obj.status, target)
        if not request.user.has_perm(required):
            raise PermissionDenied(f"'{required}' is required for this transition.")

        workflow.transition(obj, target, user=request.user, request=request, note=note)
        return self.retrieve(request, pk=pk)

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        obj = self.get_object()
        qs = versions_for(obj).select_related("edited_by")
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(ContentVersionSerializer(page, many=True).data)

    @action(
        detail=True,
        methods=["post"],
        url_path=r"versions/(?P<version_id>[0-9]+)/rollback",
    )
    def rollback(self, request, pk=None, version_id=None):
        obj = self.get_object()
        version = get_object_or_404(versions_for(obj), pk=version_id)
        rollback(obj, version, user=request.user)
        obj.refresh_from_db()
        return self.retrieve(request, pk=pk)


class SiteSettingViewSet(viewsets.ModelViewSet):
    queryset = SiteSetting.objects.all()
    serializer_class = SiteSettingSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["value_type"]
    required_permissions_map = _crud_perms("pages", "sitesetting")
    # Cache invalidation is handled by the post_save/post_delete signals
    # wired in apps.pages.apps.PagesConfig.ready().


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [HasRequiredPermissions]
    required_permissions_map = _crud_perms("pages", "tag")


class RedirectViewSet(viewsets.ModelViewSet):
    queryset = Redirect.objects.all()
    serializer_class = RedirectSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["is_permanent"]
    required_permissions_map = _crud_perms("pages", "redirect")

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
