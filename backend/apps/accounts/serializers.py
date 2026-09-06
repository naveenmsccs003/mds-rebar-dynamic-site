"""
Request validation for the auth endpoints (docs/API_DESIGN.md). Password
fields never `trim_whitespace` and are always `write_only`. Business
rules (credential check, lockout, token validation) live in
`apps.accounts.services`, not here.
"""
from __future__ import annotations

from rest_framework import serializers

from apps.permissions.introspection import permissions_payload

_password = dict(write_only=True, trim_whitespace=False, style={"input_type": "password"})


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(**_password)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(**_password)
    new_password = serializers.CharField(**_password)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(**_password)


class AuthUserSerializer(serializers.Serializer):
    """The authenticated user plus their effective authorization, for the
    admin SPA to bootstrap from. Read-only."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    full_name = serializers.CharField(source="get_full_name")
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    def _payload(self, obj) -> dict:
        cached = getattr(self, "_cached_payload", None)
        if cached is None:
            cached = permissions_payload(obj)
            self._cached_payload = cached
        return cached

    def get_roles(self, obj):
        return self._payload(obj)["roles"]

    def get_permissions(self, obj):
        return self._payload(obj)["permissions"]
