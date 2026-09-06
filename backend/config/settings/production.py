from .base import *  # noqa: F403

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
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": ["config.api_renderers.EnvelopeJSONRenderer"],
}

# --- Email ------------------------------------------------------------
# Password-reset (apps.accounts) and notification mail must go over real
# SMTP in production — never the console backend inherited from base.py.
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
if not env("EMAIL_HOST", default=""):  # noqa: F405
    raise RuntimeError("EMAIL_HOST must be set in production (password-reset mail).")

# --- Object storage (docs/FILE_STORAGE.md) ---------------------------
# Uploaded files live in S3 (or any S3-compatible service). The signed
# URL / presigned upload logic is `apps.documents.storage.S3SignedStorage`;
# `STORAGES["default"]` is django-storages' S3 backend for the raw
# read/write. Private objects are never public-read — access is always
# the signed-URL path.
_AWS_BUCKET = env("AWS_STORAGE_BUCKET_NAME", default="")  # noqa: F405
if _AWS_BUCKET:
    DOCUMENT_STORAGE_BACKEND = "apps.documents.storage.S3SignedStorage"
    _s3_options = {
        "bucket_name": _AWS_BUCKET,
        "region_name": env("AWS_S3_REGION_NAME", default=""),  # noqa: F405
        "default_acl": "private",
        "querystring_auth": True,
        "file_overwrite": False,
    }
    _endpoint = env("AWS_S3_ENDPOINT_URL", default="")  # noqa: F405
    if _endpoint:
        _s3_options["endpoint_url"] = _endpoint
    STORAGES = {
        **STORAGES,  # noqa: F405
        "default": {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": _s3_options},
    }
    # Credentials come from the environment / instance role — never settings.

# --- Error tracking -------------------------------------------------
_SENTRY_DSN = env("SENTRY_DSN", default="")  # noqa: F405
if _SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        environment="production",
        traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.05),  # noqa: F405
        send_default_pii=False,
    )
