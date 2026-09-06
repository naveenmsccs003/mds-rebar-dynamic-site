"""
Role (= `auth.Group`) read serializer for the admin UI's role picker /
permission reference. Roles are managed as code
(`apps.roles.role_permissions` + `manage.py sync_roles`), so this is
read-only — the admin UI assigns roles to *users*, it does not edit the
role→permission map.
"""
from __future__ import annotations

from django.contrib.auth.models import Group
from rest_framework import serializers


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    user_count = serializers.IntegerField(source="user_set.count", read_only=True)

    class Meta:
        model = Group
        fields = ["id", "name", "permissions", "user_count"]

    def get_permissions(self, obj) -> list[str]:
        return sorted(
            f"{p.content_type.app_label}.{p.codename}"
            for p in obj.permissions.select_related("content_type")
        )
