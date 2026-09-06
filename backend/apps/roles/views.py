"""
Role admin API (docs/RBAC_DESIGN.md).

    GET /api/v1/admin/roles/        the ten seeded auth.Groups + their
                                    effective permission codenames + user count
                                    (read-only; gated by auth.view_group)

Editing which permissions a role holds is a code change
(`apps.roles.role_permissions`) applied by `manage.py sync_roles`, not an
API operation.
"""
from __future__ import annotations

from django.contrib.auth.models import Group
from rest_framework import mixins, viewsets

from apps.permissions.permissions import HasRequiredPermissions

from .serializers import RoleSerializer


class RoleViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Group.objects.prefetch_related("permissions__content_type").order_by("name")
    serializer_class = RoleSerializer
    permission_classes = [HasRequiredPermissions]
    required_permissions_map = {
        "list": ["auth.view_group"],
        "retrieve": ["auth.view_group"],
    }
