"""
User admin API (docs/RBAC_DESIGN.md, spec §21).

    /api/v1/admin/users/          list / retrieve / create / partial_update
                                  gated by users.{view,add,change}_user

No destroy — accounts are retired with `is_active=False`
(`users.delete_user` is in ADMIN_DENIED). Every change writes an
AuditLog row; creating a user without a password emails a set-password
link (reusing the Phase 3 reset flow).
"""
from __future__ import annotations

from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, viewsets

from apps.accounts.services import send_password_reset
from apps.audit.services import log_action
from apps.permissions.permissions import HasRequiredPermissions

from .serializers import UserAdminSerializer

User = get_user_model()
ENTITY = "users.User"


class UserAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = User.objects.prefetch_related("groups").order_by("email")
    serializer_class = UserAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["is_active", "is_staff", "groups__name"]
    search_fields = ["email", "first_name", "last_name"]
    required_permissions_map = {
        "list": ["users.view_user"],
        "retrieve": ["users.view_user"],
        "create": ["users.add_user"],
        "update": ["users.change_user"],
        "partial_update": ["users.change_user"],
    }

    def _audit(self, action, user, before=None, after=None):
        log_action(
            action=action, entity_type=ENTITY, entity_id=user.pk,
            actor=self.request.user,
            ip_address=self.request.META.get("REMOTE_ADDR"),
            user_agent=self.request.META.get("HTTP_USER_AGENT", "")[:500],
            before=before, after=after,
        )

    def perform_create(self, serializer):
        user = serializer.save()
        self._audit("user.created", user, after={"email": user.email, "roles": list(
            user.groups.values_list("name", flat=True))})
        if not user.has_usable_password():
            send_password_reset(self.request, email=user.email)

    def perform_update(self, serializer):
        instance = serializer.instance
        before = {
            "is_active": instance.is_active, "is_staff": instance.is_staff,
            "roles": sorted(instance.groups.values_list("name", flat=True)),
        }
        user = serializer.save()
        after = {
            "is_active": user.is_active, "is_staff": user.is_staff,
            "roles": sorted(user.groups.values_list("name", flat=True)),
        }
        if before != after:
            self._audit("user.updated", user, before=before, after=after)
