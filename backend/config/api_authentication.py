"""
Session authentication for the admin SPA (docs/API_DESIGN.md "Auth").

Identical to DRF's `SessionAuthentication` (session cookie + CSRF on
writes) except it advertises an auth scheme via `authenticate_header`, so
an unauthenticated request to a protected endpoint gets a truthful
**401** instead of DRF's default 403-when-no-header behaviour.
"""
from rest_framework.authentication import SessionAuthentication as _SessionAuthentication


class SessionAuthentication(_SessionAuthentication):
    def authenticate_header(self, request):
        return "Session"
