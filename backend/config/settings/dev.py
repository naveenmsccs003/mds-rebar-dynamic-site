from .base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

INSTALLED_APPS += ["django.contrib.admindocs"]  # noqa: F405

# Convenience only: lets `manage.py check`/local dev run without a real
# Postgres/Redis instance available. Never used in test/staging/production.
if env.bool("USE_SQLITE_FOR_LOCAL_DEV", default=False):  # noqa: F405
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}  # noqa: F405
    # The DRF throttles read Django's cache on every request; with no
    # Redis up that 500s the throttled endpoints (login, search, …), so
    # swap in the in-process cache for this same "no services" mode.
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
