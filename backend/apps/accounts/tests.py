"""
Phase 3 — authentication flow: login/lockout, logout, session, password
change, password reset. Session-cookie auth + CSRF, per docs/API_DESIGN.md.
"""
import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test.utils import override_settings
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.users.models import User

PASSWORD = "correct-horse-staple-42"


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="staff@mdsrebar.example", password=PASSWORD, first_name="Sam"
    )


@pytest.fixture
def client():
    return APIClient()


def login(client, email, password):
    return client.post(
        "/api/v1/auth/login/", {"email": email, "password": password}, format="json"
    )


# --- login / lockout ---------------------------------------------------

@pytest.mark.django_db
def test_login_success_sets_session_and_returns_payload(client, user):
    resp = login(client, user.email, PASSWORD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["email"] == user.email
    assert body["data"]["roles"] == []
    assert "_auth_user_id" in client.session
    user.refresh_from_db()
    assert user.failed_login_count == 0
    assert user.last_login_ip is not None


@pytest.mark.django_db
def test_login_wrong_password_is_generic_401_and_counts_failure(client, user):
    resp = login(client, user.email, "wrong")
    assert resp.status_code == 401
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "INVALID_CREDENTIALS"
    user.refresh_from_db()
    assert user.failed_login_count == 1


@pytest.mark.django_db
def test_login_unknown_email_is_same_generic_401(client, db):
    resp = login(client, "nobody@mdsrebar.example", "whatever")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.django_db
def test_inactive_user_cannot_log_in_and_counter_untouched(client, user):
    user.is_active = False
    user.save(update_fields=["is_active"])
    resp = login(client, user.email, PASSWORD)
    assert resp.status_code == 401
    user.refresh_from_db()
    assert user.failed_login_count == 0


@pytest.mark.django_db
@override_settings(AUTH_LOCKOUT_THRESHOLD=3, AUTH_LOCKOUT_BASE_SECONDS=300)
def test_account_locks_after_threshold_even_with_right_password(client, user):
    for _ in range(3):
        assert login(client, user.email, "wrong").status_code == 401
    user.refresh_from_db()
    assert user.is_locked

    resp = login(client, user.email, PASSWORD)  # now correct, still refused
    assert resp.status_code == 403
    body = resp.json()
    assert body["error"]["code"] == "ACCOUNT_LOCKED"
    assert body["error"]["retry_after"] > 0
    assert "_auth_user_id" not in client.session


@pytest.mark.django_db
@override_settings(AUTH_LOCKOUT_THRESHOLD=3, AUTH_LOCKOUT_BASE_SECONDS=300)
def test_expired_lockout_allows_login_again(client, user):
    for _ in range(3):
        login(client, user.email, "wrong")
    user.refresh_from_db()
    user.locked_until = timezone.now() - timezone.timedelta(seconds=1)
    user.save(update_fields=["locked_until"])

    resp = login(client, user.email, PASSWORD)
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.failed_login_count == 0
    assert user.locked_until is None


@pytest.mark.django_db
def test_successful_login_resets_failure_counter(client, user):
    login(client, user.email, "wrong")
    user.refresh_from_db()
    assert user.failed_login_count == 1
    login(client, user.email, PASSWORD)
    user.refresh_from_db()
    assert user.failed_login_count == 0


@pytest.mark.django_db
def test_login_enforces_csrf_when_checks_are_on(db, user):
    csrf_client = APIClient(enforce_csrf_checks=True)
    # No token yet -> rejected.
    resp = csrf_client.post(
        "/api/v1/auth/login/", {"email": user.email, "password": PASSWORD}, format="json"
    )
    assert resp.status_code == 403

    csrf_client.get("/api/v1/auth/csrf/")
    token = csrf_client.cookies["csrftoken"].value
    resp = csrf_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert resp.status_code == 200


# --- logout / session ------------------------------------------------

@pytest.mark.django_db
def test_logout_requires_auth(client):
    assert client.post("/api/v1/auth/logout/").status_code == 401


@pytest.mark.django_db
def test_logout_flushes_session(client, user):
    login(client, user.email, PASSWORD)
    assert client.post("/api/v1/auth/logout/").status_code == 200
    assert "_auth_user_id" not in client.session


@pytest.mark.django_db
def test_session_endpoint_401_for_anonymous(client):
    resp = client.get("/api/v1/auth/session/")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


@pytest.mark.django_db
def test_session_endpoint_reports_roles_and_permissions(client, user):
    from django.contrib.auth.models import Group
    from django.core.management import call_command

    call_command("sync_roles")  # groups are seeded empty; give Auditor its perms
    user.groups.add(Group.objects.get(name="Auditor"))
    login(client, user.email, PASSWORD)
    data = client.get("/api/v1/auth/session/").json()["data"]
    assert data["roles"] == ["Auditor"]
    assert "audit.view_auditlog" in data["permissions"]


# --- password change -------------------------------------------------

@pytest.mark.django_db
def test_password_change_success_keeps_session(client, user):
    login(client, user.email, PASSWORD)
    resp = client.post(
        "/api/v1/auth/password/change/",
        {"current_password": PASSWORD, "new_password": "a-brand-new-secret-99"},
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.check_password("a-brand-new-secret-99")
    # session still valid after the hash change
    assert client.get("/api/v1/auth/session/").status_code == 200


@pytest.mark.django_db
def test_password_change_rejects_wrong_current(client, user):
    login(client, user.email, PASSWORD)
    resp = client.post(
        "/api/v1/auth/password/change/",
        {"current_password": "nope", "new_password": "a-brand-new-secret-99"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.django_db
def test_password_change_enforces_policy(client, user):
    login(client, user.email, PASSWORD)
    resp = client.post(
        "/api/v1/auth/password/change/",
        {"current_password": PASSWORD, "new_password": "short"},
        format="json",
    )
    assert resp.status_code == 400
    assert "new_password" in resp.json()["error"]["fields"]


@pytest.mark.django_db
def test_password_change_requires_auth(client):
    assert client.post("/api/v1/auth/password/change/").status_code == 401


# --- password reset ------------------------------------------------

@pytest.mark.django_db
def test_reset_request_sends_mail_for_known_user(client, user):
    resp = client.post(
        "/api/v1/auth/password/reset/", {"email": user.email}, format="json"
    )
    assert resp.status_code == 200
    assert len(mail.outbox) == 1
    assert user.email in mail.outbox[0].to


@pytest.mark.django_db
def test_reset_request_is_not_an_enumeration_oracle(client, user):
    known = client.post(
        "/api/v1/auth/password/reset/", {"email": user.email}, format="json"
    )
    unknown = client.post(
        "/api/v1/auth/password/reset/", {"email": "ghost@mdsrebar.example"}, format="json"
    )
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert len(mail.outbox) == 1  # nothing sent for the unknown address


@pytest.mark.django_db
def test_reset_confirm_with_valid_token_sets_password_and_clears_lock(client, user):
    user.failed_login_count = 9
    user.locked_until = timezone.now() + timezone.timedelta(hours=1)
    user.save(update_fields=["failed_login_count", "locked_until"])

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    resp = client.post(
        "/api/v1/auth/password/reset/confirm/",
        {"uid": uid, "token": token, "new_password": "fresh-password-after-reset-7"},
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.check_password("fresh-password-after-reset-7")
    assert user.failed_login_count == 0
    assert user.locked_until is None


@pytest.mark.django_db
def test_reset_confirm_rejects_bad_token(client, user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    resp = client.post(
        "/api/v1/auth/password/reset/confirm/",
        {"uid": uid, "token": "not-a-valid-token", "new_password": "whatever-secret-123"},
        format="json",
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_RESET_TOKEN"


@pytest.mark.django_db
def test_reset_confirm_enforces_password_policy(client, user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    resp = client.post(
        "/api/v1/auth/password/reset/confirm/",
        {"uid": uid, "token": token, "new_password": "12345678"},
        format="json",
    )
    assert resp.status_code == 400
    assert "new_password" in resp.json()["error"]["fields"]


# --- audit trail ---------------------------------------------------

@pytest.mark.django_db
def test_login_success_and_failure_are_audited(client, user):
    login(client, user.email, "wrong")
    login(client, user.email, PASSWORD)
    actions = set(AuditLog.objects.values_list("action", flat=True))
    assert "auth.login.failed" in actions
    assert "auth.login.succeeded" in actions
