"""
Request-scoped concerns shared by every app: a unique request ID for log
correlation (docs/SECURITY.md "Application logging"). Audit *records*
(AuditLog model, written on sensitive actions) are implemented in
`apps/audit/models.py` during Phase 2 — this middleware only provides the
request ID that both application logs and audit records key off of.
"""
import uuid


class RequestIDMiddleware:
    """Attach a unique `request_id` to every incoming request and echo it
    back as a response header, so a user-reported error can be correlated
    with server-side logs without exposing any internal detail."""

    HEADER_NAME = "X-Request-ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = request.headers.get(self.HEADER_NAME) or uuid.uuid4().hex
        response = self.get_response(request)
        response[self.HEADER_NAME] = request.request_id
        return response
