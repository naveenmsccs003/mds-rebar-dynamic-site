"""
News API (docs/API_DESIGN.md, spec §14).

Public — no auth, PUBLISHED only, newest first:
    GET /api/v1/news/                    ?category= ?tag=<slug> ?year= ?q=
    GET /api/v1/news/{slug}/

Admin — session auth + `news.*_news` permissions:
    /api/v1/admin/news/                  CRUD + transition/ + versions/ + rollback
"""
from __future__ import annotations

from django.db.models import Q
from django_filters import rest_framework as filters
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

from .models import News
from .serializers import NewsAdminSerializer, NewsDetailSerializer, NewsListSerializer


class NewsFilter(filters.FilterSet):
    tag = filters.CharFilter(field_name="tags__slug", lookup_expr="iexact")
    year = filters.NumberFilter(field_name="publish_date__year")
    q = filters.CharFilter(method="search")

    class Meta:
        model = News
        fields = ["category", "tag", "year", "q"]

    def search(self, queryset, name, value):
        return queryset.filter(
            Q(title__icontains=value) | Q(summary__icontains=value) | Q(content__icontains=value)
        )


class NewsViewSet(CachedPublicReadMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    filterset_class = NewsFilter
    cache_namespace = "news"

    def get_queryset(self):
        qs = News.objects.filter(status=PublishStatus.PUBLISHED).select_related(
            "featured_image__document", "author"
        ).prefetch_related("tags")
        if self.action == "retrieve":
            return qs.select_related("og_image__document")
        return qs.distinct()

    def get_serializer_class(self):
        return NewsDetailSerializer if self.action == "retrieve" else NewsListSerializer


class NewsAdminViewSet(WorkflowViewSetMixin, VersionedViewSetMixin, viewsets.ModelViewSet):
    queryset = News.objects.select_related("featured_image", "author", "og_image").prefetch_related("tags")
    serializer_class = NewsAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["status", "category"]
    required_permissions_map = {
        **crud_perms("news", "news"),
        **workflow_perms("news", "news"),
    }
