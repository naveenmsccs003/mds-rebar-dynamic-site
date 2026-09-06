"""
Base settings shared by every environment. Nothing environment-specific
(debug flags, allowed hosts, credentials) lives here — see dev.py /
staging.py / production.py / test.py.
"""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env("DJANGO_SECRET_KEY", default="unsafe-dev-secret-key-do-not-use-in-production")

DOMAIN_APPS = [
    "apps.accounts",
    "apps.users",
    "apps.roles",
    "apps.permissions",
    "apps.pages",
    "apps.services",
    "apps.industries",
    "apps.markets",
    "apps.portfolio",
    "apps.resources",
    "apps.news",
    "apps.blogs",
    "apps.events",
    "apps.careers",
    "apps.applications",
    "apps.enquiries",
    "apps.quotations",
    "apps.contact",
    "apps.testimonials",
    "apps.clients",
    "apps.technology",
    "apps.csr",
    "apps.legal",
    "apps.documents",
    "apps.media",
    "apps.notifications",
    "apps.audit",
    "apps.analytics",
    "apps.search",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "django_celery_beat",
]

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sitemaps",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + DOMAIN_APPS

AUTH_USER_MODEL = "users.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.middleware.RequestIDMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Database -----------------------------------------------------------
# PostgreSQL is the system of record in every environment (see
# docs/DATABASE_DESIGN.md). Configured entirely from environment
# variables — never hardcoded credentials.
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://mds_rebar:mds_rebar@localhost:5432/mds_rebar",
    )
}

# --- Password validation --------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Argon2 preferred, PBKDF2 kept as an accepted fallback so existing
# hashes still verify (docs/SECURITY.md "AuthN"). Argon2 needs
# `argon2-cffi` (requirements/base.txt); if it is ever unavailable Django
# still starts and simply uses PBKDF2.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

# --- Sessions & CSRF (docs/SECURITY.md, docs/API_DESIGN.md "Auth") -------
# The admin SPA authenticates with the Django session cookie (httpOnly,
# never readable by JS) plus CSRF protection on every state-changing
# request — no bearer token in localStorage. `*_SECURE` is left False in
# base so plain-HTTP local dev works; staging/production override it.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=False)
SESSION_COOKIE_AGE = env.int("SESSION_COOKIE_AGE", default=60 * 60 * 12)  # 12h
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_SAVE_EVERY_REQUEST = True  # sliding expiry: active users stay signed in

CSRF_COOKIE_HTTPONLY = False  # the SPA must read it to echo back as X-CSRFToken
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=False)

X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True

# --- Brute-force protection (docs/SECURITY.md "AuthN", docs/RBAC_DESIGN.md)
# Per-account progressive lockout enforced against apps.users.User's
# `failed_login_count` / `locked_until` fields, on top of the Redis-backed
# `login` DRF throttle scope (per-IP). After THRESHOLD consecutive
# failures the account locks for BASE_SECONDS, doubling on each further
# failed attempt up to MAX_SECONDS.
AUTH_LOCKOUT_THRESHOLD = env.int("AUTH_LOCKOUT_THRESHOLD", default=5)
AUTH_LOCKOUT_BASE_SECONDS = env.int("AUTH_LOCKOUT_BASE_SECONDS", default=60)
AUTH_LOCKOUT_MAX_SECONDS = env.int("AUTH_LOCKOUT_MAX_SECONDS", default=60 * 60)

# --- Email --------------------------------------------------------------
# Password-reset mail (apps.accounts) and notifications (apps.notifications).
# Base defaults to console output; real SMTP is configured from env in
# staging/production. Never fatal to a request — see apps.notifications.
EMAIL_BACKEND = env(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@mdsrebar.example")

# Where password-reset links point (the React admin route that posts the
# token back to /api/v1/auth/password-reset/confirm/).
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:5173")
PASSWORD_RESET_TIMEOUT = env.int("PASSWORD_RESET_TIMEOUT", default=60 * 60 * 24)  # 24h

# --- i18n / timezone --------------------------------------------------------
# All timestamps are stored in UTC and converted to local time only for
# display (docs/TARGET_ARCHITECTURE.md §43 future-languages readiness).
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- Static & media -------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# `MEDIA_ROOT` is the local fallback storage location used until the
# object-storage backend lands in Phase 10 (docs/FILE_STORAGE.md). It is
# git-ignored (`/media/` in backend/.gitignore). Private uploads
# (résumés) live under a non-guessable prefix within it and are never
# served by a predictable public URL — access is the authorized
# signed-URL path built in Phase 10.
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    # `default` is intentionally left to Django's FileSystemStorage
    # (MEDIA_ROOT) here; staging/production point it at object storage.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Document storage & signed access (docs/FILE_STORAGE.md) --------------
# The `StorageBackend` abstraction (apps.documents.storage) sits over
# Django's `STORAGES["default"]`. `LocalSignedStorage` is the dev/test
# backend: it stores through `default_storage` and mints HMAC-signed,
# time-limited URLs served by the `/api/v1/files/` transfer views —
# standing in for an object store's presigned PUT / GET. Production sets
# `DOCUMENT_STORAGE_BACKEND` to the S3 backend and points `default` at
# `django-storages`; nothing else in the app changes.
DOCUMENT_STORAGE_BACKEND = env(
    "DOCUMENT_STORAGE_BACKEND", default="apps.documents.storage.LocalSignedStorage"
)
DOCUMENT_DOWNLOAD_URL_TTL = env.int("DOCUMENT_DOWNLOAD_URL_TTL", default=300)   # 5 min
DOCUMENT_UPLOAD_URL_TTL = env.int("DOCUMENT_UPLOAD_URL_TTL", default=900)       # 15 min
DOCUMENT_PRIVATE_PREFIX = env("DOCUMENT_PRIVATE_PREFIX", default="private")
DOCUMENT_PUBLIC_PREFIX = env("DOCUMENT_PUBLIC_PREFIX", default="public")

# --- Search (docs/SEARCH.md) --------------------------------------------
# "auto" picks PostgresSearchProvider on PostgreSQL and the portable
# icontains SimpleSearchProvider elsewhere (the SQLite test suite). Force
# one with "postgres" / "simple".
SEARCH_PROVIDER = env("SEARCH_PROVIDER", default="auto")

# --- Career-application résumé uploads --------------------------------------
# The public career-application endpoint is the only place an anonymous
# user puts a file into the system, so every check is server-side and the
# browser is never trusted (docs/SECURITY.md "File uploads",
# docs/FILE_STORAGE.md "Resume handling"): the extension must be in the
# allow-list AND the leading bytes must match that type; the stored
# object key is randomised (never the uploaded filename); the file is
# private and left PENDING for the Phase 10 malware-scan hook.
RESUME_UPLOAD_MAX_BYTES = env.int("RESUME_UPLOAD_MAX_BYTES", default=5 * 1024 * 1024)
RESUME_UPLOAD_ALLOWED_EXTENSIONS = ["pdf", "doc", "docx"]
RESUME_UPLOAD_STORAGE_PREFIX = env("RESUME_UPLOAD_STORAGE_PREFIX", default="private/resumes")

# Internal inbox addresses for public-form alerts (apps.notifications).
# Empty in base/dev — no address means no internal alert is queued; the
# applicant / requester acknowledgement email still goes out. Set per
# environment.
CAREERS_NOTIFICATION_EMAIL = env("CAREERS_NOTIFICATION_EMAIL", default="")
SALES_NOTIFICATION_EMAIL = env("SALES_NOTIFICATION_EMAIL", default="")

# --- REST framework ---------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "config.api_authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "config.api_renderers.EnvelopeJSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/min",
        "password-reset": "5/min",
        "quote-requests": "10/min",
        "contact": "10/min",
        "career-applications": "10/min",
        "uploads": "20/min",
        "search": "60/min",
    },
    "EXCEPTION_HANDLER": "config.api_exceptions.envelope_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "MDS Rebar API",
    "DESCRIPTION": "MDS Rebar enterprise platform API (versioned, see docs/API_DESIGN.md).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# --- CORS / CSRF ------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=["http://localhost:5173"])
CORS_ALLOW_CREDENTIALS = True

# --- Celery -----------------------------------------------------------------
CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# Beat entries defined here are synced into django-celery-beat's tables on
# startup. Time-based CMS work (docs/TARGET_ARCHITECTURE.md §5).
CELERY_BEAT_SCHEDULE = {
    "pages-publish-scheduled-content": {
        "task": "pages.publish_scheduled_content",
        "schedule": 60.0,
    },
}

# --- Cache (Redis) -----------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL", default="redis://localhost:6379/1"),
    }
}

# --- Object storage abstraction ---------------------------------------------
# Concrete provider selected purely via env config; application code talks
# to Django's Storage API only (docs/FILE_STORAGE.md).
STORAGE_PROVIDER = env("STORAGE_PROVIDER", default="local")  # local | s3 | azure | gcs

# --- Logging ------------------------------------------------------------
# Structured (request ID, timestamp, level, logger, message) per
# docs/SECURITY.md — never logs passwords/tokens/secrets. See
# docs/API_DESIGN.md for how the request ID reaches these log lines.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "request_id": {"()": "config.logging_filters.RequestIDLogFilter"},
    },
    "formatters": {
        "structured": {
            "format": "%(asctime)s level=%(levelname)s logger=%(name)s request_id=%(request_id)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
            "filters": ["request_id"],
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
