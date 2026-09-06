"""
Phase 14 — public response cache (docs/PERFORMANCE.md "Caching":
"explicit invalidation on save/delete ... never a cache that can
silently serve stale content past an edit").
"""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from apps.pages.models import PublishStatus
from apps.pages.response_cache import version
from apps.services.models import Service

User = get_user_model()
PUBLIC = "/api/v1/services/"


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_second_identical_request_is_served_from_cache(api, django_assert_max_num_queries):
    Service.objects.create(name="A", slug="a", status=PublishStatus.PUBLISHED)

    first = api.get(PUBLIC)
    assert first.status_code == 200
    with django_assert_max_num_queries(0):  # pure cache hit
        second = api.get(PUBLIC)
    assert second.json() == first.json()


@pytest.mark.django_db
def test_a_write_invalidates_the_namespace(api):
    Service.objects.create(name="A", slug="a", status=PublishStatus.PUBLISHED)
    assert {s["slug"] for s in api.get(PUBLIC).json()["data"]["results"]} == {"a"}

    v_before = version("services")
    Service.objects.create(name="B", slug="b", status=PublishStatus.PUBLISHED)  # post_save -> bump
    assert version("services") > v_before

    # the next read is a fresh miss and includes the new row
    assert {s["slug"] for s in api.get(PUBLIC).json()["data"]["results"]} == {"a", "b"}


@pytest.mark.django_db
def test_admin_edit_through_the_api_is_reflected_immediately(api):
    editor = User.objects.create_user(email="ed@mds.example", password="x")
    editor.user_permissions.add(
        *Permission.objects.filter(codename__in=["add_service", "change_service", "view_service"])
    )
    svc = Service.objects.create(name="Old", slug="svc", status=PublishStatus.PUBLISHED)

    api.get(f"{PUBLIC}svc/")  # prime the cache
    api.force_login(editor)
    assert api.patch(f"/api/v1/admin/services/{svc.pk}/", {"name": "New"}, format="json").status_code == 200

    api.logout()
    assert api.get(f"{PUBLIC}svc/").json()["data"]["name"] == "New"


@pytest.mark.django_db
def test_filtered_variants_are_cached_separately(api, django_assert_max_num_queries):
    Service.objects.create(name="Rebar", slug="rebar", short_description="detailing",
                           status=PublishStatus.PUBLISHED)
    Service.objects.create(name="BIM", slug="bim", short_description="modelling",
                           status=PublishStatus.PUBLISHED)

    assert len(api.get(PUBLIC).json()["data"]["results"]) == 2
    assert len(api.get(PUBLIC, {"q": "detailing"}).json()["data"]["results"]) == 1
    # both variants now cached
    with django_assert_max_num_queries(0):
        assert len(api.get(PUBLIC).json()["data"]["results"]) == 2
        assert len(api.get(PUBLIC, {"q": "detailing"}).json()["data"]["results"]) == 1
