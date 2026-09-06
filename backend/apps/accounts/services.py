"""
Authentication flow orchestration (docs/RBAC_DESIGN.md "Session & auth
hardening", docs/SECURITY.md "AuthN").

The per-account lockout *state machine* lives on `users.User`
(`register_failed_login` / `register_successful_login` / `clear_lockout`);
this module wires it to Django's auth backend and writes an `AuditLog`
row for every security-relevant event. Keeping it out of the views means
the same rules apply from any entry point.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from apps.audit.services import log_action

logger = logging.getLogger(__name__)
User = get_user_model()

ENTITY = "users.User"


def client_ip(request) -> str | None:
    """Best-effort client IP: `REMOTE_ADDR` only. `X-Forwarded-For` is
    trusted only once the deployment's proxy hop count is known
    (docs/DEPLOYMENT.md), so it is deliberately not read here."""
    return request.META.get("REMOTE_ADDR") or None


def user_agent(request) -> str:
    return request.META.get("HTTP_USER_AGENT", "")[:500]


# --- Login ------------------------------------------------------------------


@dataclass
class LoginOutcome:
    user: object | None
    error: str | None = None  # None | "invalid_credentials" | "locked"
    locked_until: datetime | None = None


def attempt_login(request, *, email: str, password: str) -> LoginOutcome:
    """Look the account up case-insensitively, refuse it outright if
    locked, then let Django's auth backend check the credentials (it also
    rejects inactive accounts). Failure is reported identically whether
    the email is unknown, wrong, or inactive."""
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        user = None

    if user is not None and user.is_locked:
        log_action(
            action="auth.login.blocked",
            entity_type=ENTITY,
            entity_id=user.pk,
            actor=None,
            ip_address=client_ip(request),
            user_agent=user_agent(request),
        )
        return LoginOutcome(user=None, error="locked", locked_until=user.locked_until)

    username = user.get_username() if user is not None else email
    authenticated = authenticate(request, username=username, password=password)

    if authenticated is None:
        if user is not None and user.is_active:
            user.register_failed_login()
            log_action(
                action="auth.login.failed",
                entity_type=ENTITY,
                entity_id=user.pk,
                actor=None,
                ip_address=client_ip(request),
                user_agent=user_agent(request),
                after={"failed_login_count": user.failed_login_count, "locked": user.is_locked},
            )
        else:
            log_action(
                action="auth.login.failed",
                entity_type=ENTITY,
                entity_id=user.pk if user is not None else "unknown",
                actor=None,
                ip_address=client_ip(request),
                user_agent=user_agent(request),
                after={"email": email},
            )
        return LoginOutcome(user=None, error="invalid_credentials")

    authenticated.register_successful_login(ip_address=client_ip(request))
    log_action(
        action="auth.login.succeeded",
        entity_type=ENTITY,
        entity_id=authenticated.pk,
        actor=authenticated,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )
    return LoginOutcome(user=authenticated)


def log_logout(user, request) -> None:
    log_action(
        action="auth.logout",
        entity_type=ENTITY,
        entity_id=user.pk,
        actor=user,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )


# --- Password change / reset ---------------------------------------------


def change_password(user, *, new_password: str) -> None:
    """Set a new password for an already-authenticated user. Raises
    `django.core.exceptions.ValidationError` if it fails policy; the
    caller is responsible for having checked the current password."""
    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    log_action(
        action="auth.password.changed",
        entity_type=ENTITY,
        entity_id=user.pk,
        actor=user,
    )


def send_password_reset(request, *, email: str) -> None:
    """Email a reset link to every active account matching `email`
    (normally one). Returns None regardless — the view answers
    identically whether or not the address exists."""
    for user in User.objects.filter(email__iexact=email, is_active=True):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = (
            f"{settings.FRONTEND_BASE_URL.rstrip('/')}"
            f"/admin/reset-password?uid={uid}&token={token}"
        )
        context = {"user": user, "reset_url": reset_url, "uid": uid, "token": token}
        try:
            send_mail(
                subject="Reset your MDS Rebar password",
                message=render_to_string("accounts/password_reset_email.txt", context),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception:  # pragma: no cover - depends on the mail backend
            logger.exception("Password reset email failed to send", extra={"user_id": user.pk})
        log_action(
            action="auth.password_reset.requested",
            entity_type=ENTITY,
            entity_id=user.pk,
            actor=user,
            ip_address=client_ip(request),
            user_agent=user_agent(request),
        )


@dataclass
class ResetOutcome:
    user: object | None
    error: str | None = None  # None | "invalid_token"


def confirm_password_reset(request, *, uid: str, token: str, new_password: str) -> ResetOutcome:
    """Validate the uid/token pair, then set the new password (which also
    invalidates any live sessions — Django keys the session against a
    hash of the password) and clears any lockout."""
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=pk)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is None or not default_token_generator.check_token(user, token):
        return ResetOutcome(user=None, error="invalid_token")

    validate_password(new_password, user=user)
    user.set_password(new_password)
    user.failed_login_count = 0
    user.locked_until = None
    user.save(update_fields=["password", "failed_login_count", "locked_until", "updated_at"])
    log_action(
        action="auth.password_reset.completed",
        entity_type=ENTITY,
        entity_id=user.pk,
        actor=user,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )
    return ResetOutcome(user=user)
