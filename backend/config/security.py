"""
Response security headers (docs/SECURITY.md "Transport & headers").

Django's `SecurityMiddleware` already covers HSTS, `nosniff`, the SSL
redirect and `Referrer-Policy`; `XFrameOptionsMiddleware` covers
`X-Frame-Options`. This middleware adds the two it does not:

* **Content-Security-Policy** — a strict `default-src 'self'` policy.
  `style-src` allows `'unsafe-inline'` because the Django admin ships
  inline styles; nothing allows inline or remote script. Set
  `CSP_REPORT_ONLY = True` to roll it out in observation mode first.
  Paths in `CSP_EXEMPT_PREFIXES` (the OpenAPI schema + Swagger UI, which
  pull assets from a CDN and are internal tooling) are skipped.
* **Permissions-Policy** — disables browser features the app never uses
  (camera, microphone, geolocation, FLoC/`browsing-topics`, …).

`django-csp` was evaluated; this stays dependency-free and is exactly as
much policy as the Django-served surface (API + admin + docs) needs. The
public SPA is served by its own host and ships its own CSP.
"""
from __future__ import annotations

from django.conf import settings

_DEFAULT_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "object-src 'none'"
)

_DEFAULT_PERMISSIONS_POLICY = (
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), "
    "encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), "
    "magnetometer=(), microphone=(), midi=(), payment=(), usb=(), "
    "browsing-topics=()"
)


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.csp = getattr(settings, "CONTENT_SECURITY_POLICY", _DEFAULT_CSP)
        self.report_only = getattr(settings, "CSP_REPORT_ONLY", False)
        self.exempt_prefixes = tuple(
            getattr(settings, "CSP_EXEMPT_PREFIXES", ("/api/schema/", "/api/docs/"))
        )
        self.permissions_policy = getattr(
            settings, "PERMISSIONS_POLICY", _DEFAULT_PERMISSIONS_POLICY
        )

    def __call__(self, request):
        response = self.get_response(request)

        if self.permissions_policy and "Permissions-Policy" not in response:
            response["Permissions-Policy"] = self.permissions_policy

        if self.csp and not request.path.startswith(self.exempt_prefixes):
            header = (
                "Content-Security-Policy-Report-Only"
                if self.report_only
                else "Content-Security-Policy"
            )
            response.setdefault(header, self.csp)

        return response
