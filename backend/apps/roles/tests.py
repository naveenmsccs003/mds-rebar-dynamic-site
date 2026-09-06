"""
Phase 3 — RBAC role/permission seeding (docs/RBAC_DESIGN.md).

The ten role Groups are created empty by 0001_seed_default_roles; the
`sync_roles` command fills in their Django permissions from
`apps.roles.role_permissions.ROLE_PERMISSIONS`.
"""
from io import StringIO

import pytest
from django.contrib.auth.models import Group, Permission
from django.core.management import call_command

ROLE_NAMES = {
    "SuperAdmin",
    "Admin",
    "ContentManager",
    "HR",
    "Marketing",
    "BusinessDevelopment",
    "ResourceManager",
    "KnowledgeBaseMember",
    "Staff",
    "Auditor",
}


def _sync(*args):
    out = StringIO()
    call_command("sync_roles", *args, stdout=out)
    return out.getvalue()


def _codenames(role):
    return {
        f"{p.content_type.app_label}.{p.codename}"
        for p in Group.objects.get(name=role).permissions.select_related("content_type")
    }


@pytest.mark.django_db
def test_all_ten_role_groups_exist_from_migration():
    assert set(Group.objects.values_list("name", flat=True)) >= ROLE_NAMES


@pytest.mark.django_db
def test_sync_roles_superadmin_gets_every_permission():
    _sync()
    assert Group.objects.get(name="SuperAdmin").permissions.count() == Permission.objects.count()


@pytest.mark.django_db
def test_sync_roles_admin_is_all_minus_denied():
    _sync()
    admin = _codenames("Admin")
    assert "services.add_service" in admin  # ordinary permission present
    for denied in (
        "users.delete_user",
        "auth.delete_group",
        "auth.add_permission",
        "audit.add_auditlog",
        "audit.change_auditlog",
        "audit.delete_auditlog",
    ):
        assert denied not in admin


@pytest.mark.django_db
def test_sync_roles_auditor_is_read_only_on_audit():
    _sync()
    assert _codenames("Auditor") == {"audit.view_auditlog"}


@pytest.mark.django_db
def test_sync_roles_staff_has_no_permissions():
    _sync()
    assert Group.objects.get(name="Staff").permissions.count() == 0


@pytest.mark.django_db
def test_content_manager_can_edit_but_not_publish():
    _sync()
    cm = _codenames("ContentManager")
    assert "services.add_service" in cm
    assert "services.change_service" in cm
    assert "services.publish_service" not in cm
    assert "blogs.publish_blog" not in cm


@pytest.mark.django_db
def test_business_development_gets_enquiry_workflow_permissions():
    _sync()
    bd = _codenames("BusinessDevelopment")
    assert {"contact.assign_enquiry", "contact.respond_enquiry", "contact.close_enquiry"} <= bd
    assert "quotations.assign_quoterequest" in bd


@pytest.mark.django_db
def test_sync_roles_is_idempotent():
    _sync()
    first = {r: _codenames(r) for r in ROLE_NAMES}
    output = _sync()
    second = {r: _codenames(r) for r in ROLE_NAMES}
    assert first == second
    assert "already in sync" in output.lower()


@pytest.mark.django_db
def test_dry_run_reports_but_writes_nothing():
    output = _sync("--dry-run")
    assert "dry run" in output.lower()
    assert Group.objects.get(name="Auditor").permissions.count() == 0


@pytest.mark.django_db
def test_sync_roles_revokes_permissions_dropped_from_the_map():
    stray = Permission.objects.get(content_type__app_label="audit", codename="add_auditlog")
    Group.objects.get(name="Auditor").permissions.add(stray)
    _sync()
    assert _codenames("Auditor") == {"audit.view_auditlog"}


# --- Admin SPA A1: read-only role admin API -------------------------

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()
API_URL = "/api/v1/admin/roles/"


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_role_list_requires_view_group_permission(api):
    assert api.get(API_URL).status_code == 401
    user = User.objects.create_user(email="u@mds.example", password="x")
    api.force_login(user)
    assert api.get(API_URL).status_code == 403
    user.user_permissions.add(Permission.objects.get(codename="view_group"))
    api.force_login(User.objects.get(pk=user.pk))
    assert api.get(API_URL).status_code == 200


@pytest.mark.django_db
def test_role_payload_shape(api):
    api.force_login(User.objects.create_superuser(email="su@mds.example", password="x"))
    hr = Group.objects.get(name="HR")
    hr.permissions.add(*Permission.objects.filter(codename="view_jobposting"))
    User.objects.create_user(email="hr1@mds.example", password="x").groups.add(hr)

    rows = {r["name"]: r for r in api.get(API_URL).json()["data"]["results"]}
    assert "HR" in rows
    assert rows["HR"]["user_count"] == 1
    assert any(p.endswith("view_jobposting") for p in rows["HR"]["permissions"])


@pytest.mark.django_db
def test_roles_are_read_only(api):
    api.force_login(User.objects.create_superuser(email="su@mds.example", password="x"))
    assert api.post(API_URL, {"name": "Nope"}, format="json").status_code == 405
