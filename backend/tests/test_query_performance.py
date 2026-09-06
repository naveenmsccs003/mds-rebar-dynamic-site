"""
Phase 14 — query-count regression guards (docs/PERFORMANCE.md "Database":
"no endpoint returns an unbounded queryset ... query performance is
inspected during development").

Each test seeds *several* rows (with the related media / children that
the serializer touches) and asserts the endpoint's query count does not
grow with the row count — i.e. no N+1. The numbers are deliberately
snapshotted with `django_assert_max_num_queries`; a regression that adds
a per-row query fails the build.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.careers.models import JobPosting
from apps.documents.models import Visibility
from apps.documents.services import store_bytes
from apps.media.models import MediaAsset
from apps.news.models import News
from apps.pages.models import PageSection, PublishStatus
from apps.portfolio.models import Project, ProjectImage
from apps.resources.models import Resource, ResourceCategory
from apps.services.models import Service

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


@pytest.fixture
def api():
    return APIClient()


def _media(alt: str) -> MediaAsset:
    doc = store_bytes(
        category="image",
        uploaded_file=SimpleUploadedFile(f"{alt}.png", PNG, content_type="image/png"),
        visibility=Visibility.PUBLIC,
    )
    return MediaAsset.objects.create(document=doc, alt_text=alt)


@pytest.mark.django_db
def test_services_list_is_not_n_plus_one(api, django_assert_max_num_queries):
    for i in range(6):
        Service.objects.create(
            name=f"Service {i}", slug=f"svc-{i}", short_description="x",
            status=PublishStatus.PUBLISHED, hero_image=_media(f"hero{i}"), icon=_media(f"icon{i}"),
        )
    with django_assert_max_num_queries(6):
        body = api.get("/api/v1/services/").json()
    assert len(body["data"]["results"]) == 6
    assert body["data"]["results"][0]["hero_image"]["url"]  # url actually resolved


@pytest.mark.django_db
def test_service_detail_query_budget(api, django_assert_max_num_queries):
    svc = Service.objects.create(
        name="Detailing", slug="detailing", status=PublishStatus.PUBLISHED,
        hero_image=_media("h"), icon=_media("i"), og_image=_media("og"),
    )
    for n in range(4):
        svc.capabilities.create(title=f"Cap {n}", display_order=n)
        svc.process_steps.create(title=f"Step {n}", step_number=n)
        svc.faqs.create(question=f"Q{n}", answer="a", display_order=n)
    with django_assert_max_num_queries(10):
        api.get("/api/v1/services/detailing/")


@pytest.mark.django_db
def test_portfolio_list_is_not_n_plus_one(api, django_assert_max_num_queries):
    for i in range(6):
        p = Project.objects.create(
            title=f"P{i}", slug=f"p-{i}", status=PublishStatus.PUBLISHED, og_image=_media(f"og{i}"),
        )
        ProjectImage.objects.create(project=p, image=_media(f"img{i}"), display_order=0)
    with django_assert_max_num_queries(8):
        body = api.get("/api/v1/portfolio/").json()
    assert len(body["data"]["results"]) == 6
    assert body["data"]["results"][0]["cover_image"]["url"]


@pytest.mark.django_db
def test_news_list_is_not_n_plus_one(api, django_assert_max_num_queries):
    for i in range(6):
        News.objects.create(
            title=f"N{i}", slug=f"n-{i}", status=PublishStatus.PUBLISHED,
            featured_image=_media(f"fi{i}"),
        )
    with django_assert_max_num_queries(7):
        assert len(api.get("/api/v1/news/").json()["data"]["results"]) == 6


@pytest.mark.django_db
def test_resources_list_is_not_n_plus_one(api, django_assert_max_num_queries):
    for i in range(6):
        Resource.objects.create(
            title=f"R{i}", slug=f"r-{i}", category=ResourceCategory.BROCHURE,
            is_published=True, thumbnail=_media(f"th{i}"),
        )
    with django_assert_max_num_queries(6):
        body = api.get("/api/v1/resources/").json()
    assert body["data"]["results"][0]["thumbnail"]["url"]


@pytest.mark.django_db
def test_careers_list_query_budget(api, django_assert_max_num_queries):
    for i in range(8):
        JobPosting.objects.create(title=f"Job {i}", slug=f"job-{i}", is_active=True)
    with django_assert_max_num_queries(5):
        assert len(api.get("/api/v1/careers/").json()["data"]["results"]) == 8


@pytest.mark.django_db
def test_public_page_endpoint_query_budget(api, django_assert_max_num_queries):
    for i in range(10):
        PageSection.objects.create(
            page_key="home", section_key=f"s{i}", display_order=i,
            status=PublishStatus.PUBLISHED, content={},
        )
    with django_assert_max_num_queries(4):
        assert len(api.get("/api/v1/pages/home/").json()["data"]) == 10


@pytest.mark.django_db
def test_search_query_budget(api, django_assert_max_num_queries):
    for i in range(5):
        Service.objects.create(name=f"Rebar {i}", slug=f"rb-{i}", short_description="detailing",
                               status=PublishStatus.PUBLISHED)
        News.objects.create(title=f"Rebar news {i}", slug=f"rn-{i}", status=PublishStatus.PUBLISHED)
    # one query per searchable type + pagination/session overhead, flat in row count
    with django_assert_max_num_queries(12):
        api.get("/api/v1/search/", {"q": "rebar"})
