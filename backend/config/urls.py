"""
URL configuration for config project.

API routes are versioned under /api/v1/ (docs/API_DESIGN.md) and are
added app-by-app starting Phase 3 (auth) / Phase 6+ (domain APIs) — each
domain app owns its own `urls.py`, included here (or from
`config/api_v1.py`) as it's built, so this file does not need to change
shape every phase.
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from . import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health.health, name="health"),
    path("ready/", health.ready, name="ready"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
    path("api/v1/", include("config.api_v1")),
]
