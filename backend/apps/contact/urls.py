"""Enquiry routes. Included by config/api_v1.py at /api/v1/."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "contact"

admin_router = DefaultRouter()
admin_router.register("enquiries", views.EnquiryAdminViewSet, basename="admin-enquiry")

urlpatterns = [
    path("contact/", views.EnquiryCreateView.as_view(), name="enquiry-create"),
    path("admin/", include((admin_router.urls, "admin"))),
]
