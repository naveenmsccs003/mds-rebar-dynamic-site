"""
`/robots.txt` (docs/SEO.md "Sitemap & robots"): everything public is
crawlable; the admin surface and the signed-file transfer paths are not.
The `Sitemap:` line points at `/sitemap.xml` on the same host.
"""
from django.http import HttpResponse
from django.views.decorators.cache import cache_control

_DISALLOW = (
    "/admin/",
    "/api/v1/admin/",
    "/api/v1/files/",
    "/api/v1/documents/",
    "/api/schema/",
    "/api/docs/",
)


@cache_control(max_age=86400)
def robots_txt(request):
    host = request.get_host()
    scheme = "https" if request.is_secure() else request.scheme
    lines = ["User-agent: *", *[f"Disallow: {p}" for p in _DISALLOW], "Allow: /", ""]
    lines.append(f"Sitemap: {scheme}://{host}/sitemap.xml")
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")
