from django.db.models import Q
from django_filters import rest_framework as filters

from .models import Service


class ServiceFilter(filters.FilterSet):
    """Structured filters for the public service list (docs/API_DESIGN.md
    "Filtering / search"). `technology` takes a slug; `q` is a simple
    name/description contains match (the `search` app's provider replaces
    it in Phase 11)."""

    technology = filters.CharFilter(field_name="technology__slug", lookup_expr="iexact")
    q = filters.CharFilter(method="search")

    class Meta:
        model = Service
        fields = ["technology", "q"]

    def search(self, queryset, name, value):
        return queryset.filter(
            Q(name__icontains=value)
            | Q(short_description__icontains=value)
            | Q(long_description__icontains=value)
        )
