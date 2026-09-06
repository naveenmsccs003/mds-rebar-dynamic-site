"""
User admin API serializers (docs/RBAC_DESIGN.md, spec §21). Accounts are
never hard-deleted — `is_active=False` retires them (spec §19/§78) — so
there is no destroy path. Role assignment is by group *name* so the admin
UI works with the ten role labels, not opaque group ids.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


class _RoleNamesField(serializers.ListField):
    child = serializers.SlugField()

    def to_representation(self, value):
        return sorted(g.name for g in value.all())


class UserAdminSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    roles = _RoleNamesField(source="groups", required=False)
    is_locked = serializers.BooleanField(read_only=True)
    # Optional on create: an initial password. Omit it and the account is
    # created without a usable password — the user sets one via the reset
    # link the view emails.
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=False, trim_whitespace=False,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "is_active", "is_staff", "roles", "password",
            "is_locked", "last_login", "last_login_ip", "created_at", "updated_at",
        ]
        read_only_fields = ["last_login", "last_login_ip", "created_at", "updated_at"]

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_roles(self, names):
        known = set(Group.objects.filter(name__in=names).values_list("name", flat=True))
        unknown = sorted(set(names) - known)
        if unknown:
            raise serializers.ValidationError(f"Unknown role(s): {', '.join(unknown)}.")
        return names

    def _apply_roles(self, user, names):
        user.groups.set(Group.objects.filter(name__in=names))

    def create(self, validated_data):
        roles = validated_data.pop("groups", [])
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        self._apply_roles(user, roles)
        return user

    def update(self, instance, validated_data):
        roles = validated_data.pop("groups", None)
        validated_data.pop("password", None)  # password changes go through /auth/
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if roles is not None:
            self._apply_roles(instance, roles)
        return instance
