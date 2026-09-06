"""
Careers API (docs/API_DESIGN.md, spec §16).

Public — no auth:
    GET /api/v1/careers/            active postings; ?department= ?employment_type= ?location= ?q=
                                    (closed / past-deadline postings are hidden here)
    GET /api/v1/careers/{slug}/     full posting; still resolves for a closed posting so a
                                    stale link shows "applications closed" rather than a 404

Admin — session auth + `careers.*_jobposting` permissions:
    /api/v1/admin/careers/         CRUD (no publishing workflow — a plain `is_active` flag)
"""
from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from apps.pages.api_mixins import crud_perms
from apps.permissions.permissions import HasRequiredPermissions

from .models import JobPosting
from .serializers import (
    JobPostingAdminSerializer,
    JobPostingDetailSerializer,
    JobPostingListSerializer,
)


class JobPostingFilter(filters.FilterSet):
    q = filters.CharFilter(method="search")

    class Meta:
        model = JobPosting
        fields = ["department", "employment_type", "location", "q"]

    def search(self, queryset, name, value):
        return queryset.filter(
            Q(title__icontains=value)
            | Q(description__icontains=value)
            | Q(skills__icontains=value)
        )


class JobPostingViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    filterset_class = JobPostingFilter

    def get_queryset(self):
        qs = JobPosting.objects.filter(is_active=True)
        if self.action == "list":
            today = timezone.now().date()
            qs = qs.filter(Q(application_deadline__isnull=True) | Q(application_deadline__gte=today))
        return qs

    def get_serializer_class(self):
        return (
            JobPostingDetailSerializer
            if self.action == "retrieve"
            else JobPostingListSerializer
        )


class JobPostingAdminViewSet(viewsets.ModelViewSet):
    queryset = JobPosting.objects.all()
    serializer_class = JobPostingAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["is_active", "employment_type", "department"]
    required_permissions_map = crud_perms("careers", "jobposting")
