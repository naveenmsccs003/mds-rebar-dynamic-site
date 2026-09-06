"""
Enquiry API serializers (docs/API_DESIGN.md, spec §18).

Public submission is contact + message + a hidden `website` honeypot.
The admin serializer is read-only for everything the sender submitted;
`status` / `assigned_to` move through `apps.enquiries.lifecycle` checks
in the viewset. `EnquiryNote` is an append-only internal thread.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.pages.serializers import PlainTextField

from .models import Enquiry, EnquiryNote, EnquiryType


class EnquiryCreateSerializer(serializers.Serializer):
    enquiry_type = serializers.ChoiceField(
        choices=EnquiryType.choices, required=False, default=EnquiryType.CONTACT
    )
    name = PlainTextField(max_length=150)
    email = serializers.EmailField(max_length=254)
    phone = PlainTextField(max_length=30, required=False, allow_blank=True, default="")
    company = PlainTextField(max_length=150, required=False, allow_blank=True, default="")
    message = PlainTextField(max_length=5000, trim_whitespace=False)
    website = serializers.CharField(required=False, allow_blank=True, write_only=True, default="")


class EnquiryNoteSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = EnquiryNote
        fields = ["id", "note", "author", "author_email", "created_at"]
        read_only_fields = ["author", "created_at"]


class EnquiryAdminSerializer(serializers.ModelSerializer):
    assigned_to_email = serializers.EmailField(source="assigned_to.email", read_only=True)
    notes = EnquiryNoteSerializer(many=True, read_only=True)

    class Meta:
        model = Enquiry
        fields = [
            "id", "public_reference", "enquiry_type",
            "name", "email", "phone", "company", "message",
            "status", "assigned_to", "assigned_to_email", "notes",
            "ip_address", "user_agent", "created_at",
        ]
        read_only_fields = [
            "public_reference", "enquiry_type", "name", "email", "phone", "company",
            "message", "ip_address", "user_agent", "created_at",
        ]
