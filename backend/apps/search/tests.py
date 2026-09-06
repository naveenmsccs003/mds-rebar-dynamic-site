"""Phase 11 — global search: SimpleSearchProvider + the /api/v1/search/ endpoint."""
import pytest
from rest_framework.test import APIClient

from apps.careers.models import JobPosting
from apps.news.models import News
from apps.pages.models import PublishStatus
from apps.portfolio.models import Project
from apps.resources.models import Resource, ResourceCategory
from apps.services.models import Service

from .providers import SimpleSearchProvider, get_search_provider

URL = "/api/v1/search/"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def corpus(db):
    Service.objects.create(
        name="Rebar Detailing", slug="rebar-detailing",
        short_description="Shop drawings and bar bending schedules.",
        status=PublishStatus.PUBLISHED,
    )
    Service.objects.create(name="Draft Service", slug="draft-svc",
                           short_description="rebar", status=PublishStatus.DRAFT)
    Project.objects.create(
        title="Metro Tower", slug="metro-tower", description="Detailing for a rebar-heavy core.",
        status=PublishStatus.PUBLISHED,
    )
    News.objects.create(title="New rebar standard adopted", slug="rebar-standard",
                        summary="What it means.", status=PublishStatus.PUBLISHED)
    Resource.objects.create(title="Rebar Detailing Brochure", slug="rd-brochure",
                            category=ResourceCategory.BROCHURE, is_published=True)
    JobPosting.objects.create(title="Senior Detailer", slug="senior-detailer",
                              skills="rebar, Tekla", is_active=True)


@pytest.mark.django_db
def test_provider_is_simple_on_sqlite():
    assert isinstance(get_search_provider(), SimpleSearchProvider)


@pytest.mark.django_db
def test_search_spans_types_and_excludes_unpublished(api, corpus):
    body = api.get(URL, {"q": "rebar"}).json()
    assert body["success"] is True
    types = {r["type"] for r in body["data"]["results"]}
    assert types == {"service", "project", "news", "resource", "job"}
    urls = {r["url"] for r in body["data"]["results"]}
    assert "/services/rebar-detailing" in urls
    assert "/services/draft-svc" not in urls  # draft excluded
    assert body["data"]["count"] == len(body["data"]["results"])


@pytest.mark.django_db
def test_title_hits_outrank_body_hits(api, corpus):
    results = api.get(URL, {"q": "rebar"}).json()["data"]["results"]
    # "New rebar standard adopted" / "Rebar Detailing" match in the title;
    # "Metro Tower" only in the body.
    assert results[0]["score"] >= results[-1]["score"]
    metro = next(r for r in results if r["url"] == "/portfolio/metro-tower")
    detailing = next(r for r in results if r["url"] == "/services/rebar-detailing")
    assert detailing["score"] > metro["score"]


@pytest.mark.django_db
def test_type_filter(api, corpus):
    results = api.get(URL, {"q": "rebar", "type": "service"}).json()["data"]["results"]
    assert {r["type"] for r in results} == {"service"}


@pytest.mark.django_db
def test_short_query_returns_empty_with_message(api, corpus):
    body = api.get(URL, {"q": "r"}).json()
    assert body["data"]["results"] == []
    assert "at least 2" in body["message"]


@pytest.mark.django_db
def test_pagination(api, db):
    for i in range(25):
        Service.objects.create(name=f"Widget {i}", slug=f"widget-{i}",
                               short_description="findme", status=PublishStatus.PUBLISHED)
    p1 = api.get(URL, {"q": "findme"}).json()
    assert len(p1["data"]["results"]) == 20
    assert p1["data"]["num_pages"] == 2
    p2 = api.get(URL, {"q": "findme", "page": "2"}).json()
    assert len(p2["data"]["results"]) == 5


@pytest.mark.django_db
def test_search_is_throttled(api, db):
    last = None
    for _ in range(61):
        last = api.get(URL, {"q": "rebar"})
    assert last.status_code == 429


@pytest.mark.django_db
def test_snippet_strips_html(api, db):
    Project.objects.create(
        title="Clean", slug="clean", status=PublishStatus.PUBLISHED,
        description="<p>Reinforced <strong>concrete</strong> detailing throughout.</p>",
    )
    results = api.get(URL, {"q": "concrete"}).json()["data"]["results"]
    assert "<" not in results[0]["snippet"]
    assert "concrete" in results[0]["snippet"]
