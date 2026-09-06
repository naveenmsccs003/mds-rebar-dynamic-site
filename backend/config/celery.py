"""
Celery application entrypoint. Long-running work (email, notifications,
file processing, scheduled publishing, exports, search indexing,
analytics aggregation) runs here — never inline in a web request. See
docs/TARGET_ARCHITECTURE.md §5 and docs/PERFORMANCE.md.
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("mds_rebar")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
