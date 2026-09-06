"""
Phase 6 — Service API: public catalogue (published-only, filterable) and
admin CRUD with the shared publishing workflow + versioning, and the
replace-all child lists (capabilities / process steps / FAQs).
"""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from apps.pages.models import PublishStatus
from apps.pages.versioning import versions_for
from apps.services.models import Service, ServiceFAQ
from apps.technology.models import Technology

User = get_user_model()
CRUD = ["view", "add", "change", "delete"]
PUBLIC = "/api/v1/services/"
ADMIN = "/api/v1/admin/services/"


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def editor(db):
    u = User.objects.create_user(email="ed@mds.example", password="x")
    return grant(u, *[f"{v}_service" for v in CRUD])


@pytest.fixture
def publisher(db):
    u = User.objects.create_user(email="pub@mds.example", password="x")
    return grant(u, *[f"{v}_service" for v in CRUD], "publish_service")


@pytest.fixture
def published_service(db):
    return Service.objects.create(
        name="Rebar Detailing", slug="rebar-detailing",
        short_description="Shop drawings", status=PublishStatus.PUBLISHED,
    )


# --- public catalogue --------------------------------------------

@pytest.mark.django_db
def test_public_list_shows_only_published(api, published_service):
    Service.objects.create(name="Draft Svc", slug="draft-svc", status=PublishStatus.DRAFT)
    body = api.get(PUBLIC).json()
    assert body["success"] is True
    slugs = [s["slug"] for s in body["data"]["results"]]
    assert slugs == ["rebar-detailing"]


@pytest.mark.django_db
def test_public_list_filters_by_technology_slug(api, published_service):
    tekla = Technology.objects.create(name="Tekla", slug="tekla")
    other = Service.objects.create(name="Estimation", slug="estimation", status=PublishStatus.PUBLISHED)
    other.technology.add(tekla)

    results = api.get(PUBLIC, {"technology": "tekla"}).json()["data"]["results"]
    assert [s["slug"] for s in results] == ["estimation"]


@pytest.mark.django_db
def test_public_list_q_search(api, published_service):
    Service.objects.create(
        name="BIM Coordination", slug="bim", short_description="clash detection",
        status=PublishStatus.PUBLISHED,
    )
    results = api.get(PUBLIC, {"q": "clash"}).json()["data"]["results"]
    assert [s["slug"] for s in results] == ["bim"]


@pytest.mark.django_db
def test_public_detail_by_slug_includes_children(api, published_service):
    published_service.capabilities.create(title="Bar bending schedules", display_order=1)
    published_service.faqs.create(question="Formats?", answer="DWG/PDF", display_order=1)

    data = api.get(f"{PUBLIC}rebar-detailing/").json()["data"]
    assert data["name"] == "Rebar Detailing"
    assert data["capabilities"][0]["title"] == "Bar bending schedules"
    assert data["faqs"][0]["question"] == "Formats?"


@pytest.mark.django_db
def test_public_detail_404_for_unpublished_or_missing(api):
    Service.objects.create(name="Hidden", slug="hidden", status=PublishStatus.APPROVED)
    assert api.get(f"{PUBLIC}hidden/").status_code == 404
    assert api.get(f"{PUBLIC}nope/").status_code == 404


# --- admin CRUD ------------------------------------------------

@pytest.mark.django_db
def test_admin_list_permissioned(api, published_service):
    assert api.get(ADMIN).status_code == 401  # anonymous

    plain = User.objects.create_user(email="p@mds.example", password="x")
    api.force_login(plain)
    assert api.get(ADMIN).status_code == 403

    api.force_login(grant(plain, "view_service"))
    assert api.get(ADMIN).status_code == 200


@pytest.mark.django_db
def test_admin_create_with_children_starts_draft_and_versions(api, editor):
    api.force_login(editor)
    resp = api.post(
        ADMIN,
        {
            "name": "Rebar Estimation", "slug": "rebar-estimation",
            "short_description": "Quantities",
            "capabilities": [{"title": "Take-offs", "display_order": 1}],
            "process_steps": [{"title": "Review", "description": "", "step_number": 1}],
            "faqs": [{"question": "Turnaround?", "answer": "48h", "display_order": 1}],
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    svc = Service.objects.get(slug="rebar-estimation")
    assert svc.status == PublishStatus.DRAFT
    assert svc.capabilities.count() == 1 and svc.process_steps.count() == 1 and svc.faqs.count() == 1
    assert versions_for(svc).count() == 1


@pytest.mark.django_db
def test_admin_create_sanitizes_long_description(api, editor):
    api.force_login(editor)
    resp = api.post(
        ADMIN,
        {"name": "X", "slug": "x", "long_description": "<p>ok</p><script>bad()</script>"},
        format="json",
    )
    assert resp.status_code == 201
    assert "<script" not in Service.objects.get(slug="x").long_description


@pytest.mark.django_db
def test_admin_patch_replaces_children_but_only_when_supplied(api, editor, published_service):
    published_service.faqs.create(question="old?", answer="a", display_order=1)
    api.force_login(editor)

    # PATCH without `faqs` leaves them untouched
    api.patch(f"{ADMIN}{published_service.pk}/", {"name": "Renamed"}, format="json")
    assert published_service.faqs.count() == 1

    # PATCH with `faqs` replaces the whole list
    api.patch(
        f"{ADMIN}{published_service.pk}/",
        {"faqs": [{"question": "new?", "answer": "b", "display_order": 1}]},
        format="json",
    )
    faqs = list(published_service.faqs.all())
    assert len(faqs) == 1 and faqs[0].question == "new?"
    assert not ServiceFAQ.objects.filter(question="old?").exists()


@pytest.mark.django_db
def test_admin_status_is_read_only(api, editor, published_service):
    api.force_login(editor)
    api.patch(f"{ADMIN}{published_service.pk}/", {"status": "draft"}, format="json")
    published_service.refresh_from_db()
    assert published_service.status == PublishStatus.PUBLISHED


@pytest.mark.django_db
def test_admin_delete_needs_delete_perm(api, published_service):
    viewer = grant(User.objects.create_user(email="v@mds.example", password="x"), "view_service")
    api.force_login(viewer)
    assert api.delete(f"{ADMIN}{published_service.pk}/").status_code == 403


# --- workflow -----------------------------------------------

def transition(api, pk, to):
    return api.post(f"{ADMIN}{pk}/transition/", {"to": to}, format="json")


@pytest.mark.django_db
def test_editor_cannot_publish_but_publisher_can(api, editor, publisher):
    svc = Service.objects.create(name="S", slug="s", status=PublishStatus.APPROVED)

    api.force_login(editor)
    assert transition(api, svc.pk, "published").status_code == 403

    api.force_login(publisher)
    resp = transition(api, svc.pk, "published")
    assert resp.status_code == 200
    svc.refresh_from_db()
    assert svc.status == PublishStatus.PUBLISHED


@pytest.mark.django_db
def test_invalid_transition_is_400(api, publisher):
    svc = Service.objects.create(name="S", slug="s", status=PublishStatus.DRAFT)
    api.force_login(publisher)
    resp = transition(api, svc.pk, "published")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_TRANSITION"


@pytest.mark.django_db
def test_admin_versions_and_rollback(api, editor, published_service):
    api.force_login(editor)
    api.patch(f"{ADMIN}{published_service.pk}/", {"short_description": "v2"}, format="json")
    api.patch(f"{ADMIN}{published_service.pk}/", {"short_description": "v3"}, format="json")

    versions = api.get(f"{ADMIN}{published_service.pk}/versions/").json()["data"]["results"]
    assert len(versions) == 2
    oldest = versions[-1]["id"]

    resp = api.post(f"{ADMIN}{published_service.pk}/versions/{oldest}/rollback/", format="json")
    assert resp.status_code == 200
    published_service.refresh_from_db()
    assert published_service.short_description == "v2"
