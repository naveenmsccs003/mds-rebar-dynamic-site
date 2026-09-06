"""
Phase 4 — CMS API: PageSection CRUD + publishing workflow + versioning
endpoints, SiteSetting cache invalidation, Tag CRUD, public page read.

Authorisation is by Django permission (docs/RBAC_DESIGN.md); tests grant
permissions directly rather than through the role map so they stay
independent of `apps.roles`.
"""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from rest_framework.test import APIClient

from apps.pages.cache import SITE_SETTINGS_CACHE_KEY, get_site_settings
from apps.pages.models import ContentVersion, PageSection, PublishStatus, SiteSetting

User = get_user_model()

CRUD = ["view", "add", "change", "delete"]


def _grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    # drop the cached perm set
    if hasattr(user, "_perm_cache"):
        del user._perm_cache
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def viewer(db):
    u = User.objects.create_user(email="viewer@mds.example", password="x")
    return _grant(u, "view_pagesection")


@pytest.fixture
def editor(db):
    u = User.objects.create_user(email="editor@mds.example", password="x")
    return _grant(
        u,
        *[f"{v}_pagesection" for v in CRUD],
        *[f"{v}_sitesetting" for v in CRUD],
        *[f"{v}_tag" for v in CRUD],
    )


@pytest.fixture
def publisher(db):
    u = User.objects.create_user(email="publisher@mds.example", password="x")
    return _grant(u, *[f"{v}_pagesection" for v in CRUD], "publish_pagesection")


@pytest.fixture
def section(db):
    return PageSection.objects.create(
        page_key="home", section_key="hero", display_order=1,
        content={"headline": "Hi"},
    )


SECTIONS = "/api/v1/admin/cms/sections/"


# --- authorisation --------------------------------------------------

@pytest.mark.django_db
def test_admin_list_rejects_anonymous(api):
    resp = api.get(SECTIONS)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


@pytest.mark.django_db
def test_admin_list_needs_view_permission(api, section):
    plain = User.objects.create_user(email="plain@mds.example", password="x")
    api.force_login(plain)
    assert api.get(SECTIONS).status_code == 403

    api.force_login(_grant(plain, "view_pagesection"))
    assert api.get(SECTIONS).status_code == 200


@pytest.mark.django_db
def test_create_needs_add_permission(api, viewer):
    api.force_login(viewer)
    resp = api.post(SECTIONS, {"page_key": "home", "section_key": "x"}, format="json")
    assert resp.status_code == 403


# --- CRUD + versioning --------------------------------------------

@pytest.mark.django_db
def test_create_section_starts_as_draft_with_a_version(api, editor):
    api.force_login(editor)
    resp = api.post(
        SECTIONS,
        {"page_key": "about", "section_key": "team", "display_order": 2,
         "content": {"heading": "Our team"}},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    body = resp.json()["data"]
    assert body["status"] == PublishStatus.DRAFT
    obj = PageSection.objects.get(pk=body["id"])
    assert obj.current_version is not None
    assert ContentVersion.objects.filter(object_id=obj.pk).count() == 1


@pytest.mark.django_db
def test_create_sanitizes_rich_text_in_content(api, editor):
    api.force_login(editor)
    resp = api.post(
        SECTIONS,
        {"page_key": "about", "section_key": "bio",
         "content": {"body_html": "<p>ok</p><script>alert(1)</script>", "name": "<b>x</b>"}},
        format="json",
    )
    assert resp.status_code == 201
    content = resp.json()["data"]["content"]
    assert "<script" not in content["body_html"]
    assert "<p>ok</p>" in content["body_html"]
    assert content["name"] == "<b>x</b>"  # non-html key left alone


@pytest.mark.django_db
def test_patch_creates_a_new_version(api, editor, section):
    api.force_login(editor)
    resp = api.patch(f"{SECTIONS}{section.pk}/", {"display_order": 5}, format="json")
    assert resp.status_code == 200
    assert ContentVersion.objects.filter(object_id=section.pk).count() == 1
    section.refresh_from_db()
    assert section.display_order == 5


@pytest.mark.django_db
def test_status_is_read_only_on_patch(api, editor, section):
    api.force_login(editor)
    api.patch(f"{SECTIONS}{section.pk}/", {"status": "published"}, format="json")
    section.refresh_from_db()
    assert section.status == PublishStatus.DRAFT


@pytest.mark.django_db
def test_delete_needs_delete_permission(api, viewer, publisher, section):
    api.force_login(viewer)
    assert api.delete(f"{SECTIONS}{section.pk}/").status_code == 403
    api.force_login(publisher)
    assert api.delete(f"{SECTIONS}{section.pk}/").status_code == 204


# --- workflow endpoint ------------------------------------------

def _transition(api, pk, to):
    return api.post(f"{SECTIONS}{pk}/transition/", {"to": to}, format="json")


@pytest.mark.django_db
def test_editor_can_move_through_review_but_not_publish(api, editor, section):
    api.force_login(editor)
    assert _transition(api, section.pk, "review").status_code == 200
    assert _transition(api, section.pk, "approved").status_code == 200

    denied = _transition(api, section.pk, "published")
    assert denied.status_code == 403
    section.refresh_from_db()
    assert section.status == PublishStatus.APPROVED


@pytest.mark.django_db
def test_publisher_can_publish_and_published_at_is_set(api, publisher, section):
    api.force_login(publisher)
    _transition(api, section.pk, "review")
    _transition(api, section.pk, "approved")
    resp = _transition(api, section.pk, "published")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == PublishStatus.PUBLISHED
    section.refresh_from_db()
    assert section.published_at is not None


@pytest.mark.django_db
def test_illegal_transition_is_400_invalid_transition(api, publisher, section):
    api.force_login(publisher)
    resp = _transition(api, section.pk, "published")  # straight from draft
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_TRANSITION"


@pytest.mark.django_db
def test_transition_writes_audit_rows(api, publisher, section):
    from apps.audit.models import AuditLog

    api.force_login(publisher)
    _transition(api, section.pk, "review")
    assert AuditLog.objects.filter(action="content.review", entity_id=str(section.pk)).exists()


# --- versions + rollback endpoints ----------------------------

@pytest.mark.django_db
def test_versions_and_rollback(api, editor, section):
    api.force_login(editor)
    api.patch(f"{SECTIONS}{section.pk}/", {"content": {"headline": "v2"}}, format="json")
    api.patch(f"{SECTIONS}{section.pk}/", {"content": {"headline": "v3"}}, format="json")

    versions = api.get(f"{SECTIONS}{section.pk}/versions/").json()["data"]["results"]
    assert len(versions) == 2
    oldest = versions[-1]["id"]

    resp = api.post(f"{SECTIONS}{section.pk}/versions/{oldest}/rollback/", format="json")
    assert resp.status_code == 200
    section.refresh_from_db()
    assert section.content == {"headline": "v2"}


@pytest.mark.django_db
def test_rollback_rejects_foreign_version(api, editor, section):
    other = PageSection.objects.create(page_key="x", section_key="y")
    from apps.pages.versioning import snapshot

    foreign = snapshot(other)
    api.force_login(editor)
    resp = api.post(f"{SECTIONS}{section.pk}/versions/{foreign.pk}/rollback/", format="json")
    assert resp.status_code == 404


# --- SiteSetting cache ---------------------------------------

@pytest.mark.django_db
def test_sitesetting_write_invalidates_cache(api, editor):
    SiteSetting.objects.create(key="phone", value="111")
    assert get_site_settings()["phone"] == "111"  # now cached

    api.force_login(editor)
    setting = SiteSetting.objects.get(key="phone")
    api.patch(
        f"/api/v1/admin/cms/settings/{setting.pk}/", {"value": "222"}, format="json"
    )
    from django.core.cache import cache

    assert cache.get(SITE_SETTINGS_CACHE_KEY) is None
    assert get_site_settings()["phone"] == "222"


# --- tags ----------------------------------------------------

@pytest.mark.django_db
def test_tag_crud(api, editor):
    api.force_login(editor)
    created = api.post(
        "/api/v1/admin/cms/tags/", {"name": "Sustainability", "slug": "sustainability"},
        format="json",
    )
    assert created.status_code == 201
    tag_id = created.json()["data"]["id"]
    assert api.get(f"/api/v1/admin/cms/tags/{tag_id}/").status_code == 200


# --- public page read --------------------------------------

@pytest.mark.django_db
def test_public_page_returns_only_published_sections_in_order(api):
    PageSection.objects.create(page_key="home", section_key="c", display_order=3,
                               status=PublishStatus.PUBLISHED, content={"n": 3})
    PageSection.objects.create(page_key="home", section_key="a", display_order=1,
                               status=PublishStatus.PUBLISHED, content={"n": 1})
    PageSection.objects.create(page_key="home", section_key="b", display_order=2,
                               status=PublishStatus.DRAFT, content={"n": 2})
    PageSection.objects.create(page_key="about", section_key="z", display_order=1,
                               status=PublishStatus.PUBLISHED, content={"n": 9})

    resp = api.get("/api/v1/pages/home/")
    assert resp.status_code == 200
    sections = resp.json()["data"]
    assert [s["section_key"] for s in sections] == ["a", "c"]  # published only, ordered


@pytest.mark.django_db
def test_public_page_is_open_and_unknown_key_is_empty(api):
    resp = api.get("/api/v1/pages/nonexistent/")
    assert resp.status_code == 200
    assert resp.json()["data"] == []
