"""
Session-auth endpoints for the admin SPA (docs/API_DESIGN.md "Auth"):
login / logout / current session / password change / password reset.

No bearer tokens — the browser holds the Django session cookie (httpOnly)
and echoes the CSRF cookie back as `X-CSRFToken` on writes. Authorization
for domain endpoints is enforced separately by
`apps.permissions.permissions`.
"""
from __future__ import annotations

import math

from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.contrib.auth import update_session_auth_hash
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from config.api_responses import ok

from . import services
from .exceptions import AccountLocked, InvalidCredentials, InvalidResetToken, PasswordIncorrect
from .serializers import (
    AuthUserSerializer,
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFView(APIView):
    """`GET` to obtain a CSRF cookie before the SPA issues its first
    state-changing request."""

    permission_classes = [AllowAny]

    def get(self, request):
        return ok({"detail": "CSRF cookie set."})


class SessionView(APIView):
    """`GET` the current user + effective authorization, for the SPA to
    bootstrap from. 401 when not signed in — the SPA's cue to show the
    login screen."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return ok(AuthUserSerializer(request.user).data)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    """Email + password -> Django session cookie. CSRF-protected (the SPA
    calls `GET /csrf/` first) to close off login-CSRF."""

    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        outcome = services.attempt_login(
            request,
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if outcome.error == "locked":
            remaining = (outcome.locked_until - timezone.now()).total_seconds()
            raise AccountLocked(retry_after=max(1, math.ceil(remaining)))
        if outcome.error:
            raise InvalidCredentials()

        django_login(request, outcome.user)
        return ok(AuthUserSerializer(outcome.user).data, message="Signed in.")


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        services.log_logout(request.user, request)
        django_logout(request)
        return ok(None, message="Signed out.")


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user

        if not user.check_password(serializer.validated_data["current_password"]):
            raise PasswordIncorrect({"current_password": ["Incorrect password."]})

        try:
            services.change_password(
                user, new_password=serializer.validated_data["new_password"]
            )
        except DjangoValidationError as exc:
            raise ValidationError({"new_password": list(exc.messages)})

        update_session_auth_hash(request, user)
        return ok(None, message="Password updated.")


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password-reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.send_password_reset(request, email=serializer.validated_data["email"])
        # Identical response whether or not the address exists.
        return ok(
            None,
            message="If that email matches an account, a reset link is on its way.",
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password-reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            outcome = services.confirm_password_reset(
                request,
                uid=serializer.validated_data["uid"],
                token=serializer.validated_data["token"],
                new_password=serializer.validated_data["new_password"],
            )
        except DjangoValidationError as exc:
            raise ValidationError({"new_password": list(exc.messages)})

        if outcome.error:
            raise InvalidResetToken({"token": ["This reset link is invalid or has expired."]})
        return ok(None, message="Password reset. You can now sign in.")
