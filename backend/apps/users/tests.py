"""Admin SPA A1 — user admin API (docs/RBAC_DESIGN.md, spec §21)."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core import mail
from rest_framework.test import APIClient

from apps.audit.models import AuditLog

User = get_user_model()
URL = "/api/v1/admin/users/"


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def manager(db):
    return grant(
        User.objects.create_user(email="mgr@mds.example", password="x"),
        "view_user", "add_user", "change_user",
    )


@pytest.mark.django_db
def test_requires_auth_then_permission(api):
    assert api.get(URL).status_code == 401
    api.force_login(User.objects.create_user(email="p@mds.example", password="x"))
    assert api.get(URL).status_code == 403


@pytest.mark.django_db
def test_create_without_password_emails_a_set_password_link(api, manager):
    Group.objects.get_or_create(name="ContentManager")
    api.force_login(manager)
    resp = api.post(
        URL,
        {"email": "new@mds.example", "first_name": "New", "roles": ["ContentManager"], "is_staff": True},
        format="json",
    )
    assert resp.status_code == 201
    created = User.objects.get(email="new@mds.example")
    assert created.has_usable_password() is False
    assert sorted(created.groups.values_list("name", flat=True)) == ["ContentManager"]
    assert len(mail.outbox) == 1 and "new@mds.example" in mail.outbox[0].to
    assert AuditLog.objects.filter(action="user.created", entity_id=str(created.pk)).exists()


@pytest.mark.django_db
def test_unknown_role_is_rejected(api, manager):
    api.force_login(manager)
    resp = api.post(URL, {"email": "x@mds.example", "roles": ["Wizard"]}, format="json")
    assert resp.status_code == 400
    assert "roles" in resp.json()["error"]["fields"]


@pytest.mark.django_db
def test_deactivate_and_reassign_roles_is_audited(api, manager):
    Group.objects.get_or_create(name="HR")
    target = User.objects.create_user(email="t@mds.example", password="x", is_active=True)
    api.force_login(manager)
    resp = api.patch(f"{URL}{target.pk}/", {"is_active": False, "roles": ["HR"]}, format="json")
    assert resp.status_code == 200
    target.refresh_from_db()
    assert target.is_active is False
    assert list(target.groups.values_list("name", flat=True)) == ["HR"]
    assert AuditLog.objects.filter(action="user.updated", entity_id=str(target.pk)).exists()


@pytest.mark.django_db
def test_there_is_no_hard_delete(api, manager):
    target = User.objects.create_user(email="t@mds.example", password="x")
    api.force_login(grant(manager, "delete_user"))
    assert api.delete(f"{URL}{target.pk}/").status_code == 405
    assert User.objects.filter(pk=target.pk).exists()


@pytest.mark.django_db
def test_search_and_filter(api, manager):
    User.objects.create_user(email="alice@mds.example", password="x", is_active=False)
    User.objects.create_user(email="bob@other.example", password="x")
    api.force_login(manager)
    by_q = {u["email"] for u in api.get(URL, {"search": "alice"}).json()["data"]["results"]}
    assert by_q == {"alice@mds.example"}
    inactive = {u["email"] for u in api.get(URL, {"is_active": "false"}).json()["data"]["results"]}
    assert "alice@mds.example" in inactive and "bob@other.example" not in inactive
