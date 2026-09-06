"""Media routes. Included by config/api_v1.py at /api/v1/."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "media"

admin_router = DefaultRouter()
admin_router.register("media", views.MediaAssetAdminViewSet, basename="admin-media")

urlpatterns = [
    path("admin/", include((admin_router.urls, "admin"))),
]
