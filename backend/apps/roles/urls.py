"""Role admin routes. Included by config/api_v1.py at /api/v1/."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "roles"

admin_router = DefaultRouter()
admin_router.register("roles", views.RoleViewSet, basename="admin-role")

urlpatterns = [
    path("admin/", include((admin_router.urls, "admin"))),
]
