"""
`/health/` and `/ready/` endpoints for the load balancer / orchestrator
(docs/DEPLOYMENT.md, docs/BACKUP_DISASTER_RECOVERY.md "Monitoring").

* `/health/` — liveness. The process is up. Never touches a dependency,
  so a slow DB can't make the orchestrator kill a healthy process.
* `/ready/` — readiness. The instance can serve *correct* responses:
  the database and cache are reachable **and** every migration is
  applied (a rolling deploy that skipped `migrate` must not take
  traffic). Returns `503` if any of those fail, so the LB drops the
  instance instead of serving errors. The Celery broker is reported for
  visibility but does not gate readiness — the web tier serves fine
  without it; only async work degrades (watch the worker separately).
"""
from __future__ import annotations

import logging

from django.core.cache import cache
from django.db import connections
from django.db.migrations.executor import MigrationExecutor
from django.db.utils import OperationalError
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health(request):
    return JsonResponse({"status": "ok"})


def _check_database() -> str:
    try:
        connections["default"].cursor().execute("SELECT 1")
        return "ok"
    except OperationalError:
        return "unavailable"


def _check_cache() -> str:
    try:
        cache.set("readiness-check", "1", timeout=5)
        return "ok" if cache.get("readiness-check") == "1" else "unavailable"
    except Exception:
        return "unavailable"


def _check_migrations() -> str:
    try:
        executor = MigrationExecutor(connections["default"])
        targets = executor.loader.graph.leaf_nodes()
        return "ok" if not executor.migration_plan(targets) else "pending"
    except Exception:
        return "unknown"


def _check_broker() -> str:
    try:
        from config.celery import app as celery_app

        conn = celery_app.connection()
        conn.ensure_connection(max_retries=0, timeout=2)
        conn.release()
        return "ok"
    except Exception:
        return "unavailable"


# Checks that gate readiness (a failure -> 503) vs. informational ones.
_GATING = ("database", "cache", "migrations")


def ready(request):
    checks = {
        "database": _check_database(),
        "cache": _check_cache(),
        "migrations": _check_migrations(),
        "broker": _check_broker(),
    }
    healthy = all(checks[name] == "ok" for name in _GATING)
    if not healthy:
        logger.warning("readiness degraded: %s", checks)
    return JsonResponse(
        {"status": "ok" if healthy else "degraded", "checks": checks},
        status=200 if healthy else 503,
    )
