"""Phase 7 — Resource API: public catalogue (published only) + admin CRUD (no workflow)."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from apps.resources.models import Resource, ResourceCategory

User = get_user_model()
CRUD = ["view", "add", "change", "delete"]
PUBLIC = "/api/v1/resources/"
ADMIN = "/api/v1/admin/resources/"


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def editor(db):
    return grant(User.objects.create_user(email="ed@mds.example", password="x"),
                 *[f"{v}_resource" for v in CRUD])


@pytest.fixture
def brochure(db):
    return Resource.objects.create(
        title="Company Brochure", slug="company-brochure",
        category=ResourceCategory.BROCHURE, is_published=True,
    )


@pytest.mark.django_db
def test_public_list_published_only_and_filterable(api, brochure):
    Resource.objects.create(title="Draft", slug="draft", category=ResourceCategory.VIDEO)
    Resource.objects.create(
        title="Case Study", slug="cs", category=ResourceCategory.CASE_STUDY, is_published=True,
    )
    all_slugs = {r["slug"] for r in api.get(PUBLIC).json()["data"]["results"]}
    assert all_slugs == {"company-brochure", "cs"}

    filtered = api.get(PUBLIC, {"category": "case_study"}).json()["data"]["results"]
    assert [r["slug"] for r in filtered] == ["cs"]


@pytest.mark.django_db
def test_public_detail_404_when_unpublished(api):
    Resource.objects.create(title="Hidden", slug="hidden", category=ResourceCategory.WHITEPAPER)
    assert api.get(f"{PUBLIC}hidden/").status_code == 404


@pytest.mark.django_db
def test_restricted_resource_metadata_visible_but_flags_restriction(api):
    Resource.objects.create(
        title="Restricted Doc", slug="restricted-doc",
        category=ResourceCategory.TECHNICAL_DOCUMENT, access_type="restricted", is_published=True,
    )
    data = api.get(f"{PUBLIC}restricted-doc/").json()["data"]
    assert data["access_type"] == "restricted"
    assert data["has_file"] is False  # no signed URL / file link exposed here


@pytest.mark.django_db
def test_admin_crud_permissioned(api, brochure):
    assert api.get(ADMIN).status_code == 401
    plain = User.objects.create_user(email="p@mds.example", password="x")
    api.force_login(plain)
    assert api.get(ADMIN).status_code == 403
    assert api.post(ADMIN, {"title": "X", "slug": "x", "category": "video"}, format="json").status_code == 403

    api.force_login(grant(plain, "add_resource", "view_resource"))
    resp = api.post(ADMIN, {"title": "X", "slug": "x", "category": "video"}, format="json")
    assert resp.status_code == 201
    assert Resource.objects.get(slug="x").is_published is False


@pytest.mark.django_db
def test_admin_can_toggle_is_published(api, editor, brochure):
    api.force_login(editor)
    resp = api.patch(f"{ADMIN}{brochure.pk}/", {"is_published": False}, format="json")
    assert resp.status_code == 200
    brochure.refresh_from_db()
    assert brochure.is_published is False


@pytest.mark.django_db
def test_admin_download_count_is_read_only(api, editor, brochure):
    api.force_login(editor)
    api.patch(f"{ADMIN}{brochure.pk}/", {"download_count": 999}, format="json")
    brochure.refresh_from_db()
    assert brochure.download_count == 0
