"""
/health/ and /ready/ endpoints for the load balancer / orchestrator
(docs/DEPLOYMENT.md, spec §68-69). /health/ only proves the process is
up; /ready/ additionally proves the database and cache are reachable, so
a dependency outage takes the instance out of rotation instead of serving
broken responses.
"""
from django.core.cache import cache
from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse


def health(request):
    return JsonResponse({"status": "ok"})


def ready(request):
    checks = {}

    try:
        connections["default"].cursor()
        checks["database"] = "ok"
    except OperationalError:
        checks["database"] = "unavailable"

    try:
        cache.set("readiness-check", "1", timeout=5)
        checks["cache"] = "ok" if cache.get("readiness-check") == "1" else "unavailable"
    except Exception:
        checks["cache"] = "unavailable"

    all_ok = all(v == "ok" for v in checks.values())
    return JsonResponse({"status": "ok" if all_ok else "degraded", "checks": checks}, status=200 if all_ok else 503)
