"""
CMS: the Phase 2 model-shape checks (PublishableContent abstract base,
PageSection uniqueness, ContentVersion generic relation) plus the Phase 4
CMS core — HTML sanitisation, generic versioning + rollback, publishing
workflow, slug-change redirects. API-level tests are in `test_api.py`.
"""
import pytest
from django.db import IntegrityError
from django.utils import timezone

from apps.news.models import News
from apps.pages import workflow
from apps.pages.models import ContentVersion, PageSection, PublishStatus, Redirect, Tag
from apps.pages.redirects import create_redirect
from apps.pages.sanitize import sanitize_html, sanitize_json_html
from apps.pages.versioning import rollback, serialize_instance, snapshot, versions_for


# --- model shape (Phase 2) -----------------------------------------

@pytest.mark.django_db
def test_publishable_content_shared_defaults_via_news():
    """News/Blog/Event/CSR all extend the same abstract
    `PublishableContent` — exercising it through one concrete subclass is
    enough to verify the shared shape (status default, slug uniqueness,
    tag M2M) without duplicating the same test four times."""
    article = News.objects.create(title="MDS Rebar launches new office", slug="mds-launches-new-office")
    assert article.status == PublishStatus.DRAFT
    assert article.publish_date is None

    tag = Tag.objects.create(name="Company News", slug="company-news")
    article.tags.add(tag)
    assert list(article.tags.all()) == [tag]


@pytest.mark.django_db
def test_publishable_content_slug_unique_across_same_model():
    News.objects.create(title="A", slug="dup-slug")
    with pytest.raises(IntegrityError):
        News.objects.create(title="B", slug="dup-slug")


@pytest.mark.django_db
def test_page_section_unique_per_page_and_section_key():
    PageSection.objects.create(page_key="home", section_key="hero", content={"headline": "..."})
    with pytest.raises(IntegrityError):
        PageSection.objects.create(page_key="home", section_key="hero", content={})


@pytest.mark.django_db
def test_content_version_generic_relation_via_news():
    article = News.objects.create(title="A", slug="a-article")
    version = ContentVersion.objects.create(content_object=article, snapshot={"title": "A"})
    assert version.content_object == article


# --- sanitisation -----------------------------------------------------

@pytest.mark.parametrize(
    "raw, must_not_contain",
    [
        ("<script>alert(1)</script><p>ok</p>", "<script"),
        ("<p onclick='x()'>hi</p>", "onclick"),
        ("<img src=x onerror=alert(1)>", "onerror"),
        ("<iframe src='https://e.v'></iframe>", "<iframe"),
        ("<p style='position:fixed'>x</p>", "style"),
        ("<a href='javascript:alert(1)'>x</a>", "javascript:"),
        ("<object data='x'></object>", "<object"),
    ],
)
def test_sanitize_strips_dangerous_markup(raw, must_not_contain):
    assert must_not_contain not in sanitize_html(raw)


def test_sanitize_keeps_allowed_formatting():
    out = sanitize_html("<h2>T</h2><p>a <strong>b</strong> <em>c</em></p><ul><li>x</li></ul>")
    for frag in ("<h2>", "<strong>", "<em>", "<ul>", "<li>"):
        assert frag in out


def test_sanitize_hardens_external_links():
    out = sanitize_html('<a href="https://example.com">x</a>')
    assert 'rel="noopener nofollow ugc"' in out
    assert 'target="_blank"' in out


def test_sanitize_is_idempotent():
    once = sanitize_html('<p>a<a href="https://x.io">l</a></p><script>y</script>')
    assert sanitize_html(once) == once


def test_sanitize_none_and_empty():
    assert sanitize_html(None) == ""
    assert sanitize_html("") == ""


def test_sanitize_json_only_touches_html_keys():
    data = {
        "title": "<b>not touched</b>",
        "body_html": "<p>keep</p><script>drop</script>",
        "nested": {"intro_html": "<i>ok</i><iframe></iframe>", "count": 3},
        "items": [{"caption_html": "<u>u</u><script>s</script>"}],
    }
    out = sanitize_json_html(data)
    assert out["title"] == "<b>not touched</b>"  # non-html key untouched
    assert "<script" not in out["body_html"] and "<p>keep</p>" in out["body_html"]
    assert "<iframe" not in out["nested"]["intro_html"]
    assert out["nested"]["count"] == 3
    assert "<script" not in out["items"][0]["caption_html"]


# --- versioning + rollback ------------------------------------------

@pytest.fixture
def section(db):
    return PageSection.objects.create(
        page_key="home", section_key="hero", display_order=1,
        content={"headline": "v1", "body_html": "<p>one</p>"},
    )


@pytest.mark.django_db
def test_snapshot_records_field_state(section):
    v = snapshot(section, note="created")
    assert isinstance(v, ContentVersion)
    assert v.snapshot["content"] == {"headline": "v1", "body_html": "<p>one</p>"}
    assert v.snapshot["status"] == PublishStatus.DRAFT
    assert v.snapshot["__note__"] == "created"


@pytest.mark.django_db
def test_serialize_instance_uses_fk_ids(section, django_user_model):
    u = django_user_model.objects.create_user(email="e@e.com", password="x")
    section.updated_by = u
    section.save()
    data = serialize_instance(section)
    assert data["updated_by_id"] == u.pk
    assert "updated_by" not in data


@pytest.mark.django_db
def test_versions_for_is_newest_first(section):
    snapshot(section, note="a")
    snapshot(section, note="b")
    notes = [v.snapshot["__note__"] for v in versions_for(section)]
    assert notes == ["b", "a"]


@pytest.mark.django_db
def test_rollback_restores_and_reversions(section):
    v1 = snapshot(section, note="v1")
    section.content = {"headline": "v2", "body_html": "<p>two</p>"}
    section.display_order = 9
    section.save()
    snapshot(section, note="v2")

    rollback(section, v1)
    section.refresh_from_db()
    assert section.content == {"headline": "v1", "body_html": "<p>one</p>"}
    assert section.display_order == 1
    # the rollback itself is the newest version
    assert versions_for(section).first().snapshot["__note__"] == f"rollback to version {v1.pk}"


# --- workflow ------------------------------------------------------

@pytest.mark.django_db
def test_forward_path_draft_to_published(section):
    for target in (PublishStatus.REVIEW, PublishStatus.APPROVED, PublishStatus.PUBLISHED):
        workflow.transition(section, target, user=None)
    section.refresh_from_db()
    assert section.status == PublishStatus.PUBLISHED
    assert section.published_at is not None
    # one ContentVersion per transition
    assert versions_for(section).count() == 3


@pytest.mark.django_db
def test_illegal_transition_raises(section):
    from apps.pages.exceptions import InvalidTransition

    with pytest.raises(InvalidTransition):
        workflow.transition(section, PublishStatus.PUBLISHED, user=None)


@pytest.mark.django_db
def test_unpublish_clears_published_at(section):
    workflow.transition(section, PublishStatus.REVIEW, user=None)
    workflow.transition(section, PublishStatus.APPROVED, user=None)
    workflow.transition(section, PublishStatus.PUBLISHED, user=None)
    workflow.transition(section, PublishStatus.DRAFT, user=None)
    section.refresh_from_db()
    assert section.status == PublishStatus.DRAFT
    assert section.published_at is None


def test_required_permission_splits_change_from_publish():
    assert workflow.required_permission(PageSection, "approved", "published") == "pages.publish_pagesection"
    assert workflow.required_permission(PageSection, "published", "draft") == "pages.publish_pagesection"
    assert workflow.required_permission(PageSection, "draft", "review") == "pages.change_pagesection"


@pytest.mark.django_db
def test_publish_due_only_takes_past_and_approved(section, django_user_model):
    past = PageSection.objects.create(
        page_key="home", section_key="a", status=PublishStatus.APPROVED,
        scheduled_publish_at=timezone.now() - timezone.timedelta(minutes=5),
    )
    future = PageSection.objects.create(
        page_key="home", section_key="b", status=PublishStatus.APPROVED,
        scheduled_publish_at=timezone.now() + timezone.timedelta(hours=1),
    )
    draft_past = PageSection.objects.create(
        page_key="home", section_key="c", status=PublishStatus.DRAFT,
        scheduled_publish_at=timezone.now() - timezone.timedelta(minutes=5),
    )
    n = workflow.publish_due(PageSection)
    assert n == 1
    past.refresh_from_db(); future.refresh_from_db(); draft_past.refresh_from_db()
    assert past.status == PublishStatus.PUBLISHED and past.scheduled_publish_at is None
    assert future.status == PublishStatus.APPROVED
    assert draft_past.status == PublishStatus.DRAFT


# --- redirects ---------------------------------------------------

@pytest.mark.django_db
def test_create_redirect_basic():
    r = create_redirect("/services/old", "/services/new")
    assert r.old_path == "/services/old" and r.new_path == "/services/new" and r.is_permanent


@pytest.mark.django_db
def test_create_redirect_ignores_noop():
    assert create_redirect("/x", "/x") is None
    assert create_redirect("", "/x") is None
    assert Redirect.objects.count() == 0


@pytest.mark.django_db
def test_create_redirect_collapses_chain():
    create_redirect("/a", "/b")
    create_redirect("/b", "/c")  # /a should now skip straight to /c
    assert Redirect.objects.get(old_path="/a").new_path == "/c"
    assert Redirect.objects.get(old_path="/b").new_path == "/c"


@pytest.mark.django_db
def test_create_redirect_clears_reverse_row_when_path_relives():
    create_redirect("/a", "/b")
    create_redirect("/b", "/a")  # /a is a live target again
    assert not Redirect.objects.filter(old_path="/a").exists()
    assert Redirect.objects.get(old_path="/b").new_path == "/a"
