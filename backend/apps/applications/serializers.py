"""
Job-application API serializers (docs/API_DESIGN.md, spec §16).

`JobApplicationCreateSerializer` is the public submission shape: a
multipart form (name / email / phone / cover letter / résumé file) plus
a hidden `website` honeypot. The résumé file is only *bound* here —
`apps.applications.uploads.validate_resume` does the real checks in the
service layer. Free-text fields are stripped of any markup before
storage (defence in depth; they are only ever rendered as plain text).

`JobApplicationAdminSerializer` is the HR view: everything the applicant
sent is read-only; only `status` and `assigned_to` can change.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.careers.models import JobPosting
from apps.pages.serializers import PlainTextField as _PlainTextField

from .models import JobApplication


class JobApplicationCreateSerializer(serializers.Serializer):
    job = serializers.SlugRelatedField(
        slug_field="slug", queryset=JobPosting.objects.filter(is_active=True)
    )
    name = _PlainTextField(max_length=150)
    email = serializers.EmailField(max_length=254)
    phone = _PlainTextField(max_length=30, required=False, allow_blank=True, default="")
    cover_letter = _PlainTextField(
        max_length=5000, required=False, allow_blank=True, default="", trim_whitespace=False
    )
    additional_info = _PlainTextField(
        max_length=2000, required=False, allow_blank=True, default="", trim_whitespace=False
    )
    resume = serializers.FileField(write_only=True)
    # Honeypot — hidden from real users by CSS; a bot fills every field it
    # sees. A non-empty value is handled in the view (silent fake-success),
    # never reported back as an error.
    website = serializers.CharField(required=False, allow_blank=True, write_only=True, default="")


class JobApplicationAdminSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source="job.title", read_only=True)
    job_slug = serializers.SlugField(source="job.slug", read_only=True)
    resume_filename = serializers.SerializerMethodField()
    resume_status = serializers.SerializerMethodField()
    assigned_to_email = serializers.EmailField(source="assigned_to.email", read_only=True)

    class Meta:
        model = JobApplication
        fields = [
            "id", "uuid", "job", "job_title", "job_slug",
            "name", "email", "phone", "cover_letter", "additional_info",
            "resume", "resume_filename", "resume_status",
            "status", "assigned_to", "assigned_to_email",
            "ip_address", "user_agent", "created_at",
        ]
        # Only the workflow fields are writable; everything the applicant
        # submitted is immutable through the API.
        read_only_fields = [
            "uuid", "job", "name", "email", "phone", "cover_letter",
            "additional_info", "resume", "ip_address", "user_agent", "created_at",
        ]

    def get_resume_filename(self, obj) -> str:
        return obj.resume.original_filename if obj.resume_id else ""

    def get_resume_status(self, obj) -> str:
        # HR tooling must not offer a download while this is "pending"
        # (the malware scan is Phase 10). The signed-URL download path is
        # also Phase 10 — this serializer deliberately exposes no URL.
        return obj.resume.status if obj.resume_id else ""
