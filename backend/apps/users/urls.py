"""User admin routes. Included by config/api_v1.py at /api/v1/."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "users"

admin_router = DefaultRouter()
admin_router.register("users", views.UserAdminViewSet, basename="admin-user")

urlpatterns = [
    path("admin/", include((admin_router.urls, "admin"))),
]
