"""
Aggregates the versioned /api/v1/ URL surface. Each domain app owns its
own `urls.py` and is included here as it's built (Phase 3 auth first;
public + admin domain APIs from Phase 5/6 on), so `config/urls.py` does
not change shape every phase.
"""
from django.urls import include, path

app_name = "api_v1"

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.pages.urls")),
    path("", include("apps.services.urls")),
]
