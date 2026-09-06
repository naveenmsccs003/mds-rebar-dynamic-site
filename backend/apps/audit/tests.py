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
