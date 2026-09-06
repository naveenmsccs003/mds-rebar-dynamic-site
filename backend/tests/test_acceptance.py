"""
Phase 16 — acceptance suite (docs/DEVELOPMENT_PHASES.md row 16 "final
acceptance test"; docs/ACCEPTANCE.md).

One place that re-asserts the *cross-cutting* guarantees the platform is
supposed to hold, independent of any single feature's own tests. If one
of these breaks, a release is not acceptable.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


# --- response envelope (docs/API_DESIGN.md) --------------------------


@pytest.mark.django_db
def test_success_responses_use_the_envelope(api):
    body = api.get("/api/v1/services/").json()
    assert body["success"] is True
    assert set(body) >= {"success", "data", "message", "meta"}


@pytest.mark.django_db
def test_error_responses_use_the_envelope(api):
    body = api.get("/api/v1/services/does-not-exist/").json()
    assert body["success"] is False
    assert set(body["error"]) >= {"code", "message"}
    assert body["error"]["code"] == "NOT_FOUND"


# --- authz is server-side (docs/RBAC_DESIGN.md) ---------------------


@pytest.mark.django_db
def test_admin_endpoints_reject_anonymous_then_under_permissioned(api):
    assert api.get("/api/v1/admin/services/").status_code == 401
    api.force_login(User.objects.create_user(email="nobody@mds.example", password="x"))
    assert api.get("/api/v1/admin/services/").status_code == 403


@pytest.mark.django_db
def test_audit_log_has_no_write_route(api):
    # Append-only is structural: there is simply no mutating endpoint.
    staff = User.objects.create_user(email="s@mds.example", password="x", is_staff=True, is_superuser=True)
    api.force_login(staff)
    for path in ("/api/v1/admin/audit/", "/api/v1/audit/", "/api/v1/admin/auditlog/"):
        assert api.post(path, {}, format="json").status_code in (403, 404, 405)


# --- transport / hardening (docs/SECURITY.md) ---------------------


@pytest.mark.django_db
def test_security_headers_present_on_every_response(client):
    resp = client.get("/api/v1/services/")
    assert "Content-Security-Policy" in resp
    assert resp["Permissions-Policy"]
    assert resp["X-Content-Type-Options"] == "nosniff"


@pytest.mark.django_db
def test_public_writes_are_throttled(api):
    # the `contact` scope is 10/min — the 11th call is refused
    last = None
    for _ in range(11):
        last = api.post(
            "/api/v1/contact/",
            {"name": "x", "email": "x@x.com", "message": "m", "website": "bot"},
            format="json",
        )
    assert last.status_code == 429


# --- operability (docs/DEPLOYMENT.md / SEO.md) -------------------


@pytest.mark.django_db
def test_health_readiness_robots_and_sitemap_are_served(client):
    assert client.get("/health/").status_code == 200
    assert client.get("/ready/").status_code in (200, 503)

    robots = client.get("/robots.txt")
    assert robots.status_code == 200 and "Disallow: /admin/" in robots.content.decode()

    sitemap = client.get("/sitemap.xml")
    assert sitemap.status_code == 200 and b"<urlset" in sitemap.content


@pytest.mark.django_db
def test_global_search_endpoint_answers(api):
    from apps.pages.models import PublishStatus
    from apps.services.models import Service

    Service.objects.create(name="Rebar Detailing", slug="rd", short_description="x",
                           status=PublishStatus.PUBLISHED)
    body = api.get("/api/v1/search/", {"q": "rebar"}).json()
    assert body["success"] is True
    assert any(r["url"] == "/services/rd" for r in body["data"]["results"])


@pytest.mark.django_db
def test_private_documents_are_not_downloadable_anonymously(api):
    from django.core.files.uploadedfile import SimpleUploadedFile

    from apps.documents.services import store_bytes

    doc = store_bytes(
        category="document",
        uploaded_file=SimpleUploadedFile("f.pdf", b"%PDF-1.4\n%%EOF\n", content_type="application/pdf"),
    )
    assert api.get(f"/api/v1/documents/{doc.uuid}/download/").status_code == 403
