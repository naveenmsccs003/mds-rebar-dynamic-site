import pytest

from .models import AuditLog
from .services import log_action


@pytest.mark.django_db
def test_log_action_creates_record_with_expected_shape():
    entry = log_action(
        action="service.published",
        entity_type="services.Service",
        entity_id=42,
        before={"status": "draft"},
        after={"status": "published"},
    )
    assert AuditLog.objects.count() == 1
    assert entry.actor is None  # system-initiated action
    assert entry.before == {"status": "draft"}
    assert entry.after == {"status": "published"}


@pytest.mark.django_db
def test_audit_log_survives_actor_deletion():
    """spec §78 — audit history must outlive the user it's about, so the
    FK is SET_NULL rather than CASCADE."""
    from apps.users.models import User

    user = User.objects.create_user(email="actor@example.com", password="x")
    entry = log_action(action="login.success", entity_type="users.User", entity_id=user.pk, actor=user)

    user.delete()
    entry.refresh_from_db()
    assert entry.actor is None


# --- Admin SPA A1: read-only audit log API ------------------------

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

User = get_user_model()
API_URL = "/api/v1/admin/audit/"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def auditor(db):
    u = User.objects.create_user(email="aud@mds.example", password="x")
    u.user_permissions.add(Permission.objects.get(codename="view_auditlog"))
    return User.objects.get(pk=u.pk)


@pytest.mark.django_db
def test_audit_read_requires_view_auditlog(api):
    assert api.get(API_URL).status_code == 401
    api.force_login(User.objects.create_user(email="p@mds.example", password="x"))
    assert api.get(API_URL).status_code == 403


@pytest.mark.django_db
def test_audit_list_is_newest_first_and_filterable(api, auditor):
    log_action(action="user.created", entity_type="users.User", entity_id=1)
    log_action(action="service.published", entity_type="services.Service", entity_id=2)
    api.force_login(auditor)

    body = api.get(API_URL).json()["data"]
    assert [r["action"] for r in body["results"]] == ["service.published", "user.created"]

    filtered = api.get(API_URL, {"action": "user.created"}).json()["data"]["results"]
    assert [r["entity_type"] for r in filtered] == ["users.User"]


@pytest.mark.django_db
def test_audit_is_strictly_read_only_even_for_superuser(api):
    api.force_login(User.objects.create_superuser(email="su@mds.example", password="x"))
    row = log_action(action="x", entity_type="y", entity_id="1")
    assert api.post(API_URL, {"action": "z", "entity_type": "y", "entity_id": "1"},
                    format="json").status_code == 403
    assert api.patch(f"{API_URL}{row.pk}/", {"action": "z"}, format="json").status_code == 403
    assert api.delete(f"{API_URL}{row.pk}/").status_code == 403
