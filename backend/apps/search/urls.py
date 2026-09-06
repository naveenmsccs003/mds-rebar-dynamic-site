"""Search route. Included by config/api_v1.py at /api/v1/."""
from django.urls import path

from . import views

app_name = "search"

urlpatterns = [
    path("search/", views.SearchView.as_view(), name="search"),
]
