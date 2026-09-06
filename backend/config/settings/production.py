from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])  # noqa: F405

if not SECRET_KEY or SECRET_KEY == "unsafe-dev-secret-key-do-not-use-in-production":  # noqa: F405
    raise RuntimeError("DJANGO_SECRET_KEY must be set to a real secret in production.")

# --- Transport & cookie security (docs/SECURITY.md) --------------------
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # the frontend must be able to read the CSRF cookie to echo it back
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"

# TLS terminates at the load balancer / ingress (docs/DEPLOYMENT.md).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Content-Security-Policy is enforced (not report-only) in production
# (config.security.SecurityHeadersMiddleware).
CSP_REPORT_ONLY = False

# No browsable HTML API in production — JSON only. The OpenAPI schema /
# Swagger UI at /api/{schema,docs}/ stay reachable for internal use but
# are disallowed in robots.txt and should be auth-gated at the proxy.
REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": ["config.api_renderers.EnvelopeJSONRenderer"],
}

# --- Email ------------------------------------------------------------
# Password-reset (apps.accounts) and notification mail must go over real
# SMTP in production — never the console backend inherited from base.py.
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
if not env("EMAIL_HOST", default=""):  # noqa: F405
    raise RuntimeError("EMAIL_HOST must be set in production (password-reset mail).")
