"""
Auth routes, mounted at /api/v1/auth/ by config/urls.py
(docs/API_DESIGN.md "Versioning").
"""
from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("csrf/", views.CSRFView.as_view(), name="csrf"),
    path("session/", views.SessionView.as_view(), name="session"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("password/change/", views.PasswordChangeView.as_view(), name="password-change"),
    path("password/reset/", views.PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "password/reset/confirm/",
        views.PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
]
