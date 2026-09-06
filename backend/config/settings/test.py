from .base import *  # noqa: F403

DEBUG = False
SECRET_KEY = "test-secret-key"
ALLOWED_HOSTS = ["testserver", "localhost"]

# Fast, isolated, no external services required to run the test suite.
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # fast hashing in tests only

# Password-reset mail lands in `django.core.mail.outbox` for assertions.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# The manifest-hashed static storage requires `collectstatic` to have run
# first (it looks up a manifest file) — irrelevant for what the test
# suite verifies, so tests use plain static file serving instead.
# `default` is in-memory so résumé-upload tests never touch the disk.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
