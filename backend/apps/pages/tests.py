import pytest
from django.db import IntegrityError

from apps.news.models import News

from .models import ContentVersion, PageSection, PublishStatus, Tag


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
