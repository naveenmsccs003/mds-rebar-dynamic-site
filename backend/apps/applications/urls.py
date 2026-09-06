"""Job-application routes. Included by config/api_v1.py at /api/v1/."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "applications"

admin_router = DefaultRouter()
admin_router.register(
    "career-applications", views.JobApplicationAdminViewSet, basename="admin-career-application"
)

urlpatterns = [
    path(
        "career-applications/",
        views.JobApplicationCreateView.as_view(),
        name="career-application-create",
    ),
    path("admin/", include((admin_router.urls, "admin"))),
]
