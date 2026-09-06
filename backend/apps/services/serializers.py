"""
Service API serializers (docs/API_DESIGN.md, spec §10/§11 — one reusable
model + template renders every service).

Public read serializers expose only render-facing fields; the admin
serializer is writable, sanitises the rich-text field, keeps `status`
read-only (it moves via the `transition` action), and manages the three
ordered child lists (capabilities / process steps / FAQs) with
replace-all semantics on write.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.pages.serializers import (
    MediaRefSerializer,
    NamedSlugRefSerializer,
    SanitizedHTMLField,
)

from .models import Service, ServiceCapability, ServiceFAQ, ServiceProcessStep

TechnologyRefSerializer = NamedSlugRefSerializer


class ServiceCapabilitySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = ServiceCapability
        fields = ["id", "title", "description", "display_order"]


class ServiceProcessStepSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = ServiceProcessStep
        fields = ["id", "title", "description", "step_number"]


class ServiceFAQSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = ServiceFAQ
        fields = ["id", "question", "answer", "display_order"]


class ServiceListSerializer(serializers.ModelSerializer):
    hero_image = MediaRefSerializer(read_only=True)
    icon = MediaRefSerializer(read_only=True)

    class Meta:
        model = Service
        fields = ["id", "name", "slug", "short_description", "hero_image", "icon", "display_order"]


class ServiceDetailSerializer(serializers.ModelSerializer):
    hero_image = MediaRefSerializer(read_only=True)
    icon = MediaRefSerializer(read_only=True)
    og_image = MediaRefSerializer(read_only=True)
    technology = TechnologyRefSerializer(many=True, read_only=True)
    capabilities = ServiceCapabilitySerializer(many=True, read_only=True)
    process_steps = ServiceProcessStepSerializer(many=True, read_only=True)
    faqs = ServiceFAQSerializer(many=True, read_only=True)

    class Meta:
        model = Service
        fields = [
            "id", "name", "slug", "short_description", "long_description",
            "hero_image", "icon", "og_image",
            "business_value", "standards_codes", "deliverables", "output_formats",
            "technology", "capabilities", "process_steps", "faqs",
            "display_order",
            "seo_title", "seo_description", "seo_keywords",
            "updated_at",
        ]


class ServiceAdminSerializer(serializers.ModelSerializer):
    long_description = SanitizedHTMLField(required=False, allow_blank=True)
    capabilities = ServiceCapabilitySerializer(many=True, required=False)
    process_steps = ServiceProcessStepSerializer(many=True, required=False)
    faqs = ServiceFAQSerializer(many=True, required=False)

    _CHILD_RELATIONS = {
        "capabilities": ServiceCapability,
        "process_steps": ServiceProcessStep,
        "faqs": ServiceFAQ,
    }

    class Meta:
        model = Service
        fields = [
            "id", "name", "slug", "short_description", "long_description",
            "hero_image", "icon", "og_image",
            "business_value", "standards_codes", "deliverables", "output_formats",
            "technology", "capabilities", "process_steps", "faqs",
            "display_order", "status",
            "seo_title", "seo_description", "seo_keywords",
            "created_at", "updated_at",
        ]
        read_only_fields = ["status", "created_at", "updated_at"]

    def _write_children(self, service: Service, children: dict) -> None:
        for field, rows in children.items():
            model = self._CHILD_RELATIONS[field]
            getattr(service, field).all().delete()
            model.objects.bulk_create(
                model(service=service, **{k: v for k, v in row.items() if k != "id"})
                for row in rows
            )

    def create(self, validated_data):
        children = {f: validated_data.pop(f) for f in self._CHILD_RELATIONS if f in validated_data}
        technology = validated_data.pop("technology", [])
        service = Service.objects.create(**validated_data)
        if technology:
            service.technology.set(technology)
        self._write_children(service, children)
        return service

    def update(self, instance, validated_data):
        children = {f: validated_data.pop(f) for f in self._CHILD_RELATIONS if f in validated_data}
        technology = validated_data.pop("technology", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if technology is not None:
            instance.technology.set(technology)
        self._write_children(instance, children)
        return instance
