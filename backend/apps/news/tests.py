"""Phase 7 — News API: public feed (published only, newest first) + admin CRUD + workflow."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.utils import timezone
from rest_framework.test import APIClient

from apps.news.models import News
from apps.pages.models import PublishStatus, Tag
from apps.pages.versioning import versions_for

User = get_user_model()
CRUD = ["view", "add", "change", "delete"]
PUBLIC = "/api/v1/news/"
ADMIN = "/api/v1/admin/news/"


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def editor(db):
    return grant(User.objects.create_user(email="ed@mds.example", password="x", first_name="Ed"),
                 *[f"{v}_news" for v in CRUD])


@pytest.fixture
def publisher(db):
    return grant(User.objects.create_user(email="pub@mds.example", password="x"),
                 *[f"{v}_news" for v in CRUD], "publish_news")


def make_news(**kw):
    kw.setdefault("status", PublishStatus.PUBLISHED)
    return News.objects.create(**kw)


@pytest.mark.django_db
def test_public_feed_published_only_newest_first(api):
    make_news(title="Older", slug="older", publish_date=timezone.now() - timezone.timedelta(days=5))
    make_news(title="Newer", slug="newer", publish_date=timezone.now())
    make_news(title="Draft", slug="draft", status=PublishStatus.DRAFT)

    slugs = [n["slug"] for n in api.get(PUBLIC).json()["data"]["results"]]
    assert slugs == ["newer", "older"]


@pytest.mark.django_db
def test_public_feed_filters_by_tag_and_year(api):
    tag = Tag.objects.create(name="Sustainability", slug="sustainability")
    n = make_news(title="Green", slug="green", publish_date=timezone.datetime(2024, 6, 1, tzinfo=timezone.get_current_timezone()))
    n.tags.add(tag)
    make_news(title="Other", slug="other", publish_date=timezone.now())

    assert [x["slug"] for x in api.get(PUBLIC, {"tag": "sustainability"}).json()["data"]["results"]] == ["green"]
    assert [x["slug"] for x in api.get(PUBLIC, {"year": 2024}).json()["data"]["results"]] == ["green"]


@pytest.mark.django_db
def test_public_detail_includes_content_and_author(api, editor):
    make_news(title="Story", slug="story", content="<p>Body</p>", author=editor)
    data = api.get(f"{PUBLIC}story/").json()["data"]
    assert data["content"] == "<p>Body</p>"
    assert data["author_name"] == "Ed"


@pytest.mark.django_db
def test_public_detail_404_for_draft(api):
    make_news(title="WIP", slug="wip", status=PublishStatus.DRAFT)
    assert api.get(f"{PUBLIC}wip/").status_code == 404


@pytest.mark.django_db
def test_admin_create_sets_author_sanitizes_and_versions(api, editor):
    api.force_login(editor)
    resp = api.post(
        ADMIN,
        {"title": "Launch", "slug": "launch", "content": "<p>hi</p><script>x()</script>"},
        format="json",
    )
    assert resp.status_code == 201, resp.content
    n = News.objects.get(slug="launch")
    assert n.author == editor
    assert n.status == PublishStatus.DRAFT
    assert "<script" not in n.content
    assert versions_for(n).count() == 1


@pytest.mark.django_db
def test_admin_transition_requires_publish_perm(api, editor, publisher):
    n = make_news(title="Q", slug="q", status=PublishStatus.APPROVED)
    api.force_login(editor)
    assert api.post(f"{ADMIN}{n.pk}/transition/", {"to": "published"}, format="json").status_code == 403
    api.force_login(publisher)
    assert api.post(f"{ADMIN}{n.pk}/transition/", {"to": "published"}, format="json").status_code == 200


@pytest.mark.django_db
def test_admin_tags_assignable_by_id(api, editor):
    t1 = Tag.objects.create(name="BIM", slug="bim")
    api.force_login(editor)
    resp = api.post(ADMIN, {"title": "T", "slug": "t", "tags": [t1.pk]}, format="json")
    assert resp.status_code == 201
    assert list(News.objects.get(slug="t").tags.values_list("slug", flat=True)) == ["bim"]
