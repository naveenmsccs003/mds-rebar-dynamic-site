"""Quote-request routes. Included by config/api_v1.py at /api/v1/."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "quotations"

admin_router = DefaultRouter()
admin_router.register(
    "quote-requests", views.QuoteRequestAdminViewSet, basename="admin-quote-request"
)

urlpatterns = [
    path("quote-requests/", views.QuoteRequestCreateView.as_view(), name="quote-request-create"),
    path("admin/", include((admin_router.urls, "admin"))),
]
