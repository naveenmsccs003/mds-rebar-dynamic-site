"""Phase 11 — /robots.txt and /sitemap.xml."""
import pytest

from apps.careers.models import JobPosting
from apps.news.models import News
from apps.pages.models import PublishStatus
from apps.services.models import Service


@pytest.mark.django_db
def test_robots_txt_blocks_admin_and_points_at_the_sitemap(client):
    resp = client.get("/robots.txt")
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("text/plain")
    text = resp.content.decode()
    assert "Disallow: /admin/" in text
    assert "Disallow: /api/v1/admin/" in text
    assert "Disallow: /api/v1/files/" in text
    assert "Allow: /" in text
    assert "Sitemap: http://testserver/sitemap.xml" in text


@pytest.mark.django_db
def test_sitemap_lists_published_content_only(client):
    Service.objects.create(name="Live", slug="live", status=PublishStatus.PUBLISHED)
    Service.objects.create(name="Draft", slug="draft", status=PublishStatus.DRAFT)
    News.objects.create(title="Post", slug="post", status=PublishStatus.PUBLISHED)
    JobPosting.objects.create(title="Role", slug="role", is_active=True)
    JobPosting.objects.create(title="Closed", slug="closed", is_active=False)

    resp = client.get("/sitemap.xml")
    assert resp.status_code == 200
    xml = resp.content.decode()
    assert "/services/live" in xml
    assert "/services/draft" not in xml
    assert "/news/post" in xml
    assert "/careers/role" in xml
    assert "/careers/closed" not in xml
    # static routes are in there too
    assert "/about" in xml and "/legal/privacy-policy" in xml
