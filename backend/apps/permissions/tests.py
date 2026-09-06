"""
Phase 3 — reusable DRF permission classes (docs/RBAC_DESIGN.md
"Enforcement points"). These guard every protected domain endpoint from
Phase 6 on, so they are unit-tested directly here against the request
factory rather than through a live viewset.
"""
import pytest
from django.contrib.auth.models import Permission
from rest_framework.test import APIRequestFactory

from apps.audit.models import AuditLog
from apps.permissions.permissions import (
    HasModelPermission,
    HasRequiredPermissions,
    IsActiveUser,
    IsAuditReader,
    ReadOnly,
)
from apps.permissions.introspection import permissions_payload
from apps.users.models import User

factory = APIRequestFactory()


@pytest.fixture
def user(db):
    return User.objects.create_user(email="p@mdsrebar.example", password="x-very-secret-123")


def _grant(user, app_label, codename):
    user.user_permissions.add(
        Permission.objects.get(content_type__app_label=app_label, codename=codename)
    )
    return User.objects.get(pk=user.pk)  # drop the cached _perm_cache


class _View:
    queryset = AuditLog.objects.all()


# --- IsActiveUser ----------------------------------------------------------

@pytest.mark.django_db
def test_is_active_user(user):
    req = factory.get("/")
    req.user = user
    assert IsActiveUser().has_permission(req, _View()) is True

    user.is_active = False
    assert IsActiveUser().has_permission(req, _View()) is False


@pytest.mark.django_db
def test_is_active_user_rejects_anonymous():
    from django.contrib.auth.models import AnonymousUser

    req = factory.get("/")
    req.user = AnonymousUser()
    assert IsActiveUser().has_permission(req, _View()) is False


# --- ReadOnly ------------------------------------------------------------

def test_read_only():
    assert ReadOnly().has_permission(factory.get("/"), _View()) is True
    assert ReadOnly().has_permission(factory.post("/"), _View()) is False


# --- HasModelPermission -------------------------------------------------

@pytest.mark.django_db
def test_has_model_permission_requires_view_perm_for_reads(user):
    req = factory.get("/")
    req.user = user
    assert HasModelPermission().has_permission(req, _View()) is False

    req.user = _grant(user, "audit", "view_auditlog")
    assert HasModelPermission().has_permission(req, _View()) is True


@pytest.mark.django_db
def test_has_model_permission_write_needs_write_perm(user):
    req = factory.post("/")
    req.user = _grant(user, "audit", "view_auditlog")
    assert HasModelPermission().has_permission(req, _View()) is False

    req.user = _grant(user, "audit", "add_auditlog")
    assert HasModelPermission().has_permission(req, _View()) is True


@pytest.mark.django_db
def test_has_model_permission_rejects_anonymous():
    from django.contrib.auth.models import AnonymousUser

    req = factory.get("/")
    req.user = AnonymousUser()
    assert HasModelPermission().has_permission(req, _View()) is False


# --- HasRequiredPermissions -------------------------------------------

@pytest.mark.django_db
def test_has_required_permissions_list(user):
    class V:
        required_permissions = ["audit.view_auditlog"]

    req = factory.get("/")
    req.user = user
    assert HasRequiredPermissions().has_permission(req, V()) is False

    req.user = _grant(user, "audit", "view_auditlog")
    assert HasRequiredPermissions().has_permission(req, V()) is True


@pytest.mark.django_db
def test_has_required_permissions_map_by_method(user):
    class V:
        required_permissions = ["audit.view_auditlog"]
        required_permissions_map = {"POST": ["audit.add_auditlog"]}

    req = factory.post("/")
    req.user = _grant(user, "audit", "view_auditlog")  # has view, not add
    assert HasRequiredPermissions().has_permission(req, V()) is False

    req.user = _grant(user, "audit", "add_auditlog")
    assert HasRequiredPermissions().has_permission(req, V()) is True


# --- IsAuditReader ----------------------------------------------------

@pytest.mark.django_db
def test_is_audit_reader_allows_read_with_perm(user):
    req = factory.get("/")
    req.user = _grant(user, "audit", "view_auditlog")
    assert IsAuditReader().has_permission(req, _View()) is True


@pytest.mark.django_db
def test_is_audit_reader_denies_all_writes_even_for_superuser(db):
    su = User.objects.create_superuser(email="su@mdsrebar.example", password="x-very-secret-123")
    req = factory.delete("/")
    req.user = su
    assert IsAuditReader().has_permission(req, _View()) is False


@pytest.mark.django_db
def test_is_audit_reader_denies_read_without_perm(user):
    req = factory.get("/")
    req.user = user
    assert IsAuditReader().has_permission(req, _View()) is False


# --- permissions_payload --------------------------------------------

@pytest.mark.django_db
def test_permissions_payload_shape(user):
    from django.contrib.auth.models import Group

    g = Group.objects.get(name="Auditor")
    g.permissions.add(
        Permission.objects.get(content_type__app_label="audit", codename="view_auditlog")
    )
    user.groups.add(g)
    payload = permissions_payload(User.objects.get(pk=user.pk))
    assert payload["roles"] == ["Auditor"]
    assert "audit.view_auditlog" in payload["permissions"]
    assert payload["is_superuser"] is False
    assert payload["is_staff"] is False
