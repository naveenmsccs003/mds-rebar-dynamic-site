"""Portfolio routes. Included by config/api_v1.py at /api/v1/."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "portfolio"

public_router = DefaultRouter()
public_router.register("portfolio", views.ProjectViewSet, basename="project")

admin_router = DefaultRouter()
admin_router.register("portfolio", views.ProjectAdminViewSet, basename="admin-project")

urlpatterns = [
    path("", include(public_router.urls)),
    path("admin/", include((admin_router.urls, "admin"))),
]
