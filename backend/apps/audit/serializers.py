"""Audit log read serializer (docs/SECURITY.md "Audit logging")."""
from __future__ import annotations

from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = [
            "id", "action", "entity_type", "entity_id",
            "actor", "actor_email", "before", "after",
            "ip_address", "user_agent", "timestamp",
        ]
        read_only_fields = fields
