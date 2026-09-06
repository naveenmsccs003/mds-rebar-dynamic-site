"""
`/sitemap.xml` from published content (docs/SEO.md "Sitemap & robots").

`django.contrib.sitemaps` with per-type `Sitemap` classes — no
`django.contrib.sites` dependency (the sitemap view falls back to
`RequestSite`, so URLs use the request host). `protocol = "https"`
because the public site is served over TLS; behind a TLS-terminating
proxy set `SECURE_PROXY_SSL_HEADER` so `request.scheme` agrees.
"""
from __future__ import annotations

from django.contrib.sitemaps import Sitemap

from apps.careers.models import JobPosting
from apps.news.models import News
from apps.pages.models import PublishStatus
from apps.portfolio.models import Project
from apps.resources.models import Resource
from apps.services.models import Service


class _Base(Sitemap):
    protocol = "https"
    changefreq = "weekly"

    def lastmod(self, obj):
        return getattr(obj, "updated_at", None)


class ServiceSitemap(_Base):
    priority = 0.8
    changefreq = "monthly"

    def items(self):
        return Service.objects.filter(status=PublishStatus.PUBLISHED)

    def location(self, obj):
        return f"/services/{obj.slug}"


class ProjectSitemap(_Base):
    priority = 0.6

    def items(self):
        return Project.objects.filter(status=PublishStatus.PUBLISHED)

    def location(self, obj):
        return f"/portfolio/{obj.slug}"


class NewsSitemap(_Base):
    priority = 0.6

    def items(self):
        return News.objects.filter(status=PublishStatus.PUBLISHED)

    def location(self, obj):
        return f"/news/{obj.slug}"


class ResourceSitemap(_Base):
    priority = 0.5
    changefreq = "monthly"

    def items(self):
        return Resource.objects.filter(is_published=True)

    def location(self, obj):
        return f"/resources#{obj.slug}"


class JobSitemap(_Base):
    priority = 0.7

    def items(self):
        return JobPosting.objects.filter(is_active=True)

    def location(self, obj):
        return f"/careers/{obj.slug}"

    def lastmod(self, obj):
        return obj.updated_at


class StaticViewSitemap(Sitemap):
    protocol = "https"
    priority = 0.5
    changefreq = "monthly"

    def items(self):
        return [
            "/", "/about", "/services", "/portfolio", "/resources", "/news",
            "/careers", "/contact", "/request-quote",
            "/legal/privacy-policy", "/legal/terms", "/legal/nda", "/legal/data-security",
        ]

    def location(self, item):
        return item


SITEMAPS = {
    "static": StaticViewSitemap,
    "services": ServiceSitemap,
    "portfolio": ProjectSitemap,
    "news": NewsSitemap,
    "resources": ResourceSitemap,
    "careers": JobSitemap,
}
