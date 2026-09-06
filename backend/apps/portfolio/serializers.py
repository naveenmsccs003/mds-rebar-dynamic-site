"""
Portfolio API serializers (docs/API_DESIGN.md, spec §12). Public reads
expose only render fields for PUBLISHED projects; the list endpoint is
always server-filtered + paginated — the whole table never reaches the
browser. The admin serializer sanitises `description`, keeps `status`
read-only (it moves via `transition`), and manages the ordered image
list with replace-all semantics.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.media.models import MediaAsset
from apps.pages.serializers import (
    MediaRefSerializer,
    NamedSlugRefSerializer,
    SanitizedHTMLField,
    WorkflowStatusMixin,
)

from .models import Project, ProjectDocument, ProjectImage


class ProjectImageSerializer(serializers.Serializer):
    image = MediaRefSerializer(read_only=True)
    display_order = serializers.IntegerField()


class ProjectImageWriteSerializer(serializers.Serializer):
    image = serializers.PrimaryKeyRelatedField(queryset=MediaAsset.objects.all())
    display_order = serializers.IntegerField(default=0)


class ProjectDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectDocument
        fields = ["id", "label", "is_public"]


class _ProjectBase(serializers.ModelSerializer):
    country = serializers.SerializerMethodField()
    client_industry = NamedSlugRefSerializer(read_only=True)
    og_image = MediaRefSerializer(read_only=True)

    def get_country(self, obj):
        if obj.country_id is None:
            return None
        return {"id": obj.country.id, "name": obj.country.name, "code": obj.country.code}


class ProjectListSerializer(_ProjectBase):
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "title", "slug", "category", "completion_year", "is_featured",
            "country", "client_industry", "og_image", "cover_image",
        ]

    def get_cover_image(self, obj):
        first = obj.images.all()[:1]
        return MediaRefSerializer(first[0].image).data if first else None


class ProjectDetailSerializer(_ProjectBase):
    services = NamedSlugRefSerializer(many=True, read_only=True)
    technology = NamedSlugRefSerializer(many=True, read_only=True)
    images = ProjectImageSerializer(many=True, read_only=True)
    documents = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "title", "slug", "category", "description", "completion_year", "is_featured",
            "country", "client_industry", "services", "technology",
            "images", "documents", "og_image",
            "seo_title", "seo_description", "updated_at",
        ]

    def get_documents(self, obj):
        public = obj.documents.filter(is_public=True)
        return ProjectDocumentSerializer(public, many=True).data


class ProjectAdminSerializer(WorkflowStatusMixin, serializers.ModelSerializer):
    description = SanitizedHTMLField(required=False, allow_blank=True)
    images = ProjectImageWriteSerializer(many=True, required=False)

    class Meta:
        model = Project
        fields = [
            "id", "title", "slug", "category", "description", "completion_year", "is_featured",
            "country", "client_industry", "services", "technology", "images",
            "status", "allowed_transitions", "seo_title", "seo_description", "og_image",
            "created_at", "updated_at",
        ]
        read_only_fields = ["allowed_transitions", "status", "created_at", "updated_at"]

    def _write_images(self, project: Project, rows: list[dict]) -> None:
        project.images.all().delete()
        ProjectImage.objects.bulk_create(
            ProjectImage(project=project, image=row["image"], display_order=row.get("display_order", 0))
            for row in rows
        )

    def create(self, validated_data):
        images = validated_data.pop("images", None)
        services = validated_data.pop("services", [])
        technology = validated_data.pop("technology", [])
        project = Project.objects.create(**validated_data)
        project.services.set(services)
        project.technology.set(technology)
        if images is not None:
            self._write_images(project, images)
        return project

    def update(self, instance, validated_data):
        images = validated_data.pop("images", None)
        services = validated_data.pop("services", None)
        technology = validated_data.pop("technology", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if services is not None:
            instance.services.set(services)
        if technology is not None:
            instance.technology.set(technology)
        if images is not None:
            self._write_images(instance, images)
        return instance
