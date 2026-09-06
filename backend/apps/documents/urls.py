"""Document routes. Included by config/api_v1.py at /api/v1/."""
from django.urls import path

from . import views

app_name = "documents"

urlpatterns = [
    path("admin/documents/upload/", views.DocumentUploadView.as_view(), name="upload"),
    path(
        "admin/documents/<uuid:uuid>/complete/",
        views.DocumentCompleteView.as_view(),
        name="complete",
    ),
    path(
        "documents/<uuid:uuid>/download/",
        views.DocumentDownloadView.as_view(),
        name="download",
    ),
    # Local storage backend transfer endpoints (see views).
    path("files/u/<str:token>/", views.TransferUploadView.as_view(), name="transfer-upload"),
    path("files/d/<str:token>/", views.TransferDownloadView.as_view(), name="transfer-download"),
]
