from django.db.models import Q
from django_filters import rest_framework as filters

from .models import Project


class ProjectFilter(filters.FilterSet):
    """Structured filters for the public portfolio list
    (docs/DATABASE_DESIGN.md: `?country=UAE&service=rebar-detailing`).
    Everything is server-side — the full table is never sent."""

    country = filters.CharFilter(field_name="country__code", lookup_expr="iexact")
    service = filters.CharFilter(field_name="services__slug", lookup_expr="iexact")
    industry = filters.CharFilter(field_name="client_industry__slug", lookup_expr="iexact")
    year = filters.NumberFilter(field_name="completion_year")
    featured = filters.BooleanFilter(field_name="is_featured")
    q = filters.CharFilter(method="search")

    class Meta:
        model = Project
        fields = ["country", "service", "industry", "year", "featured", "q"]

    def search(self, queryset, name, value):
        return queryset.filter(
            Q(title__icontains=value)
            | Q(description__icontains=value)
            | Q(category__icontains=value)
        )
