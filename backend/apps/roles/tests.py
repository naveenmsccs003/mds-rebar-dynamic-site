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
