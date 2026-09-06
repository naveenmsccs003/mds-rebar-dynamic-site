"""
CMS routes. Included by config/api_v1.py at /api/v1/.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "pages"

router = DefaultRouter()
router.register("sections", views.PageSectionViewSet, basename="cms-section")
router.register("settings", views.SiteSettingViewSet, basename="cms-setting")
router.register("tags", views.TagViewSet, basename="cms-tag")
router.register("redirects", views.RedirectViewSet, basename="cms-redirect")

urlpatterns = [
    path("admin/cms/", include((router.urls, "cms"))),
    path("pages/<slug:page_key>/", views.PublicPageView.as_view(), name="public-page"),
]
