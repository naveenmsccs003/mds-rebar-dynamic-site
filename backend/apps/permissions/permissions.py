"""
Reusable DRF permission classes (docs/RBAC_DESIGN.md "Enforcement points",
docs/API_DESIGN.md "Authorization").

The rule from RBAC_DESIGN.md: the frontend hiding a button is UX only —
every security-relevant decision is re-checked here, on the backend, on
every request, against the authenticated user's *actual* Django
permissions. Roles are `auth.Group`s; permissions are
`<app_label>.<action>_<model>` strings (standard CRUD plus custom ones
like `services.publish_service`).

Domain viewsets (Phase 6+) opt in by setting `permission_classes` and,
for `HasRequiredPermissions`, a `required_permissions` /
`required_permissions_map` attribute.
"""
from __future__ import annotations

from rest_framework.permissions import (
    SAFE_METHODS,
    BasePermission,
    DjangoModelPermissions,
)


class IsActiveUser(BasePermission):
    """Authenticated *and* not soft-disabled.

    `User.is_active = False` is how accounts are retired (spec §19/§78) —
    Django's auth backend already refuses login for them, this covers the
    window where such a user still holds a live session cookie.
    """

    message = "Your account is inactive."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.is_active)


class ReadOnly(BasePermission):
    """Allow safe methods only. Compose with another class for
    "everyone can read, only some can write" endpoints."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class HasModelPermission(DjangoModelPermissions):
    """`DjangoModelPermissions`, but:

    * read requests (GET/HEAD/OPTIONS) require `<app>.view_<model>` —
      stock `DjangoModelPermissions` lets anyone read;
    * anonymous requests are rejected outright rather than deferred to
      the view.

    The model is taken from the view's `queryset` / `get_queryset()`, so
    a viewset gets the right permission map for free.
    """

    authenticated_users_only = True
    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": ["%(app_label)s.view_%(model_name)s"],
        "HEAD": ["%(app_label)s.view_%(model_name)s"],
        "POST": ["%(app_label)s.add_%(model_name)s"],
        "PUT": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.delete_%(model_name)s"],
    }


class HasRequiredPermissions(BasePermission):
    """Check an explicit permission list declared on the view.

    Use when the required permission is not a plain CRUD verb on the
    view's own model — e.g. a `publish` action, or an endpoint that
    touches several models::

        class ServiceViewSet(ModelViewSet):
            permission_classes = [HasRequiredPermissions]
            required_permissions = ["services.view_service"]
            required_permissions_map = {
                "POST": ["services.add_service"],
                "publish": ["services.publish_service"],
            }

    `required_permissions_map` is keyed by HTTP method or by DRF action
    name; its entries replace (not extend) `required_permissions` for
    that method/action. All listed permissions are required (AND).
    """

    message = "You do not have permission to perform this action."

    def _required(self, request, view):
        mapping = getattr(view, "required_permissions_map", None) or {}
        action = getattr(view, "action", None)
        if action and action in mapping:
            return mapping[action]
        if request.method in mapping:
            return mapping[request.method]
        return getattr(view, "required_permissions", []) or []

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and user.is_active):
            return False
        required = self._required(request, view)
        return user.has_perms(required)


class IsAuditReader(BasePermission):
    """Read-only access to audit records for holders of
    `audit.view_auditlog`; every write method is refused unconditionally.

    The audit trail is append-only (docs/SECURITY.md "Audit logging"):
    no role — not even SuperAdmin — edits or deletes it through the API,
    so this deliberately does not fall through to `has_perm` for writes.
    """

    message = "The audit log is read-only."

    def has_permission(self, request, view):
        if request.method not in SAFE_METHODS:
            return False
        user = getattr(request, "user", None)
        if not (user and user.is_authenticated and user.is_active):
            return False
        return user.has_perm("audit.view_auditlog")
