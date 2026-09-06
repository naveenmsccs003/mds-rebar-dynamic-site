from .base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

INSTALLED_APPS += ["django.contrib.admindocs"]  # noqa: F405

# Convenience only: lets `manage.py check`/local dev run without a real
# Postgres/Redis instance available. Never used in test/staging/production.
if env.bool("USE_SQLITE_FOR_LOCAL_DEV", default=False):  # noqa: F405
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}  # noqa: F405
