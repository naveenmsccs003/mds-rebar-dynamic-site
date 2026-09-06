"""Phase 8 — Careers: JobPosting model + public catalogue + admin CRUD."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APIClient

from .models import JobPosting

User = get_user_model()
CRUD = ["view", "add", "change", "delete"]
PUBLIC = "/api/v1/careers/"
ADMIN = "/api/v1/admin/careers/"


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def hr(db):
    return grant(
        User.objects.create_user(email="hr@mds.example", password="x"),
        *[f"{v}_jobposting" for v in CRUD],
    )


@pytest.fixture
def detailer(db):
    return JobPosting.objects.create(
        title="Rebar Detailer", slug="rebar-detailer", department="Detailing",
        location="Dubai", employment_type="full_time", skills="AutoCAD, aSa, RebarCAD",
        description="Detail reinforcement drawings.",
    )


# --- model ---------------------------------------------------------------


@pytest.mark.django_db
def test_slug_must_be_unique():
    JobPosting.objects.create(title="Rebar Detailer", slug="rebar-detailer")
    with pytest.raises(IntegrityError):
        JobPosting.objects.create(title="Rebar Detailer 2", slug="rebar-detailer")


@pytest.mark.django_db
def test_defaults_to_active():
    posting = JobPosting.objects.create(title="BIM Engineer", slug="bim-engineer")
    assert posting.is_active is True


@pytest.mark.django_db
def test_is_open_reflects_active_flag_and_deadline():
    today = timezone.now().date()
    assert JobPosting(is_active=True, application_deadline=None).is_open is True
    assert JobPosting(is_active=False, application_deadline=None).is_open is False
    assert JobPosting(is_active=True, application_deadline=today + timedelta(days=1)).is_open is True
    assert JobPosting(is_active=True, application_deadline=today - timedelta(days=1)).is_open is False


# --- public catalogue --------------------------------------------------


@pytest.mark.django_db
def test_public_list_active_and_unexpired_only(api, detailer):
    JobPosting.objects.create(title="Closed role", slug="closed", is_active=False)
    JobPosting.objects.create(
        title="Expired role", slug="expired", is_active=True,
        application_deadline=timezone.now().date() - timedelta(days=1),
    )
    body = api.get(PUBLIC).json()
    assert body["success"] is True
    assert [p["slug"] for p in body["data"]["results"]] == ["rebar-detailer"]


@pytest.mark.django_db
def test_public_list_filters_and_search(api, detailer):
    JobPosting.objects.create(
        title="Estimator", slug="estimator", department="Estimation",
        employment_type="contract", description="Quantity take-offs.",
    )
    by_dept = api.get(PUBLIC, {"department": "Estimation"}).json()["data"]["results"]
    assert [p["slug"] for p in by_dept] == ["estimator"]

    by_q = api.get(PUBLIC, {"q": "AutoCAD"}).json()["data"]["results"]
    assert [p["slug"] for p in by_q] == ["rebar-detailer"]


@pytest.mark.django_db
def test_public_detail_exposes_skills_list_and_is_open(api, detailer):
    data = api.get(f"{PUBLIC}rebar-detailer/").json()["data"]
    assert data["skills_list"] == ["AutoCAD", "aSa", "RebarCAD"]
    assert data["is_open"] is True


@pytest.mark.django_db
def test_public_detail_resolves_for_expired_posting_but_flags_closed(api):
    JobPosting.objects.create(
        title="Expired", slug="expired", is_active=True,
        application_deadline=timezone.now().date() - timedelta(days=2),
    )
    resp = api.get(f"{PUBLIC}expired/")
    assert resp.status_code == 200
    assert resp.json()["data"]["is_open"] is False


@pytest.mark.django_db
def test_public_detail_404_for_inactive(api):
    JobPosting.objects.create(title="Hidden", slug="hidden", is_active=False)
    assert api.get(f"{PUBLIC}hidden/").status_code == 404


# --- admin CRUD ------------------------------------------------------


@pytest.mark.django_db
def test_admin_requires_auth_then_permission(api, detailer):
    assert api.get(ADMIN).status_code == 401
    plain = User.objects.create_user(email="p@mds.example", password="x")
    api.force_login(plain)
    assert api.get(ADMIN).status_code == 403
    assert api.post(ADMIN, {"title": "X", "slug": "x"}, format="json").status_code == 403


@pytest.mark.django_db
def test_admin_can_create_and_deactivate(api, hr, detailer):
    api.force_login(hr)
    resp = api.post(
        ADMIN,
        {"title": "QA Engineer", "slug": "qa-engineer", "employment_type": "full_time"},
        format="json",
    )
    assert resp.status_code == 201

    resp = api.patch(f"{ADMIN}{detailer.pk}/", {"is_active": False}, format="json")
    assert resp.status_code == 200
    detailer.refresh_from_db()
    assert detailer.is_active is False


@pytest.mark.django_db
def test_admin_list_sees_inactive_postings(api, hr):
    JobPosting.objects.create(title="Hidden", slug="hidden", is_active=False)
    api.force_login(hr)
    slugs = {p["slug"] for p in api.get(ADMIN).json()["data"]["results"]}
    assert "hidden" in slugs
