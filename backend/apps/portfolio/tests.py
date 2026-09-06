"""Phase 7 — Portfolio API: public filtered/paginated catalogue + admin CRUD."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from apps.industries.models import Industry
from apps.markets.models import Country
from apps.pages.models import PublishStatus
from apps.portfolio.models import Project
from apps.services.models import Service

User = get_user_model()
CRUD = ["view", "add", "change", "delete"]
PUBLIC = "/api/v1/portfolio/"
ADMIN = "/api/v1/admin/portfolio/"


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def editor(db):
    return grant(User.objects.create_user(email="ed@mds.example", password="x"),
                 *[f"{v}_project" for v in CRUD])


@pytest.fixture
def publisher(db):
    return grant(User.objects.create_user(email="pub@mds.example", password="x"),
                 *[f"{v}_project" for v in CRUD], "publish_project")


@pytest.fixture
def project(db):
    return Project.objects.create(
        title="Metro Tower", slug="metro-tower", category="Commercial",
        completion_year=2025, status=PublishStatus.PUBLISHED,
    )


@pytest.mark.django_db
def test_public_list_is_published_only_and_paginated(api, project):
    Project.objects.create(title="Draft", slug="draft", status=PublishStatus.DRAFT)
    body = api.get(PUBLIC).json()
    assert body["success"] is True
    assert "results" in body["data"] and "count" in body["data"]
    assert [p["slug"] for p in body["data"]["results"]] == ["metro-tower"]


@pytest.mark.django_db
def test_public_list_filters(api, project):
    uae = Country.objects.create(name="United Arab Emirates", code="AE")
    ind = Industry.objects.create(name="Healthcare", slug="healthcare")
    svc = Service.objects.create(name="Rebar Detailing", slug="rebar-detailing")
    p2 = Project.objects.create(
        title="Hospital", slug="hospital", country=uae, client_industry=ind,
        completion_year=2024, is_featured=True, status=PublishStatus.PUBLISHED,
    )
    p2.services.add(svc)

    assert [p["slug"] for p in api.get(PUBLIC, {"country": "AE"}).json()["data"]["results"]] == ["hospital"]
    assert [p["slug"] for p in api.get(PUBLIC, {"industry": "healthcare"}).json()["data"]["results"]] == ["hospital"]
    assert [p["slug"] for p in api.get(PUBLIC, {"service": "rebar-detailing"}).json()["data"]["results"]] == ["hospital"]
    assert [p["slug"] for p in api.get(PUBLIC, {"year": 2024}).json()["data"]["results"]] == ["hospital"]
    assert [p["slug"] for p in api.get(PUBLIC, {"featured": "true"}).json()["data"]["results"]] == ["hospital"]


@pytest.mark.django_db
def test_public_detail_404_for_unpublished(api):
    Project.objects.create(title="Hidden", slug="hidden", status=PublishStatus.REVIEW)
    assert api.get(f"{PUBLIC}hidden/").status_code == 404
    assert api.get(f"{PUBLIC}missing/").status_code == 404


@pytest.mark.django_db
def test_admin_list_permissioned(api, project):
    assert api.get(ADMIN).status_code == 401
    plain = User.objects.create_user(email="p@mds.example", password="x")
    api.force_login(plain)
    assert api.get(ADMIN).status_code == 403
    api.force_login(grant(plain, "view_project"))
    assert api.get(ADMIN).status_code == 200


@pytest.mark.django_db
def test_admin_create_starts_draft_sanitizes_and_versions(api, editor):
    api.force_login(editor)
    resp = api.post(
        ADMIN,
        {"title": "New", "slug": "new", "description": "<p>ok</p><script>x()</script>"},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    p = Project.objects.get(slug="new")
    assert p.status == PublishStatus.DRAFT
    assert "<script" not in p.description
    from apps.pages.versioning import versions_for
    assert versions_for(p).count() == 1


@pytest.mark.django_db
def test_admin_status_read_only_and_transition_gated(api, editor, publisher):
    p = Project.objects.create(title="P", slug="p", status=PublishStatus.APPROVED)
    api.force_login(editor)
    api.patch(f"{ADMIN}{p.pk}/", {"status": "draft"}, format="json")
    p.refresh_from_db()
    assert p.status == PublishStatus.APPROVED  # ignored

    assert api.post(f"{ADMIN}{p.pk}/transition/", {"to": "published"}, format="json").status_code == 403
    api.force_login(publisher)
    assert api.post(f"{ADMIN}{p.pk}/transition/", {"to": "published"}, format="json").status_code == 200
    p.refresh_from_db()
    assert p.status == PublishStatus.PUBLISHED
