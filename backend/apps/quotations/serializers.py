"""
Quote-request API serializers (docs/API_DESIGN.md, spec §17).

`QuoteRequestCreateSerializer` is the public submission shape: contact +
project detail, related services referenced by slug, a hidden `website`
honeypot. Free text is tag-stripped (`PlainTextField`).

`QuoteRequestAdminSerializer` is the sales view — everything the
requester sent is read-only; only `status` and `assigned_to` move, and
those go through `apps.enquiries.lifecycle` permission checks in the
viewset.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.markets.models import Country
from apps.pages.models import PublishStatus
from apps.pages.serializers import PlainTextField
from apps.services.models import Service

from .models import QuoteRequest

_PUBLISHED_SERVICES = Service.objects.filter(status=PublishStatus.PUBLISHED)


class QuoteRequestCreateSerializer(serializers.Serializer):
    name = PlainTextField(max_length=150)
    company = PlainTextField(max_length=150, required=False, allow_blank=True, default="")
    email = serializers.EmailField(max_length=254)
    phone = PlainTextField(max_length=30, required=False, allow_blank=True, default="")
    country = serializers.SlugRelatedField(
        slug_field="code", queryset=Country.objects.all(), required=False, allow_null=True
    )
    service = serializers.SlugRelatedField(
        slug_field="slug", queryset=_PUBLISHED_SERVICES, required=False, allow_null=True
    )
    required_services = serializers.SlugRelatedField(
        slug_field="slug", queryset=_PUBLISHED_SERVICES, many=True, required=False, default=list
    )
    project_type = PlainTextField(max_length=150, required=False, allow_blank=True, default="")
    project_location = PlainTextField(max_length=255, required=False, allow_blank=True, default="")
    project_size = PlainTextField(max_length=100, required=False, allow_blank=True, default="")
    timeline = PlainTextField(max_length=100, required=False, allow_blank=True, default="")
    message = PlainTextField(
        max_length=5000, required=False, allow_blank=True, default="", trim_whitespace=False
    )
    website = serializers.CharField(required=False, allow_blank=True, write_only=True, default="")


class _UserRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()


class QuoteRequestAdminSerializer(serializers.ModelSerializer):
    country_code = serializers.SlugField(source="country.code", read_only=True)
    service_slug = serializers.SlugField(source="service.slug", read_only=True)
    required_service_slugs = serializers.SerializerMethodField()
    assigned_to_email = serializers.EmailField(source="assigned_to.email", read_only=True)

    class Meta:
        model = QuoteRequest
        fields = [
            "id", "public_reference",
            "name", "company", "email", "phone",
            "country", "country_code", "service", "service_slug", "required_service_slugs",
            "project_type", "project_location", "project_size", "timeline", "message",
            "status", "assigned_to", "assigned_to_email",
            "ip_address", "user_agent", "created_at", "updated_at",
        ]
        read_only_fields = [
            "public_reference", "name", "company", "email", "phone",
            "country", "service", "project_type", "project_location", "project_size",
            "timeline", "message", "ip_address", "user_agent", "created_at", "updated_at",
        ]

    def get_required_service_slugs(self, obj) -> list[str]:
        return list(obj.required_services.values_list("slug", flat=True))
