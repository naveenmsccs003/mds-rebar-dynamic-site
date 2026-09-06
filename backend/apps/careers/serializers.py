"""
Careers API serializers (docs/API_DESIGN.md, spec §16).

Public reads expose only render-facing fields for active postings; the
job description fields are plain text (not rich text), so nothing here
needs HTML sanitisation. The admin serializer is writable and keeps the
timestamps read-only.
"""
from __future__ import annotations

from rest_framework import serializers

from .models import JobPosting

_DESCRIPTION_FIELDS = ["description", "responsibilities", "requirements", "benefits"]


class JobPostingListSerializer(serializers.ModelSerializer):
    is_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = JobPosting
        fields = [
            "id", "title", "slug", "department", "location",
            "employment_type", "experience", "application_deadline",
            "is_open", "created_at",
        ]


class JobPostingDetailSerializer(serializers.ModelSerializer):
    is_open = serializers.BooleanField(read_only=True)
    skills_list = serializers.SerializerMethodField()

    class Meta:
        model = JobPosting
        fields = [
            "id", "title", "slug", "department", "location",
            "employment_type", "experience", "skills", "skills_list",
            *_DESCRIPTION_FIELDS,
            "application_deadline", "is_open", "created_at", "updated_at",
        ]

    def get_skills_list(self, obj) -> list[str]:
        return [s.strip() for s in (obj.skills or "").split(",") if s.strip()]


class JobPostingAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobPosting
        fields = [
            "id", "title", "slug", "department", "location",
            "employment_type", "experience", "skills",
            *_DESCRIPTION_FIELDS,
            "application_deadline", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
