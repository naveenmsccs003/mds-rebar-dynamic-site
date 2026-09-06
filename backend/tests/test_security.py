"""Phase 12 — security hardening: response headers + baseline throttling."""
import pytest
from rest_framework.test import APIClient


# --- security headers (config.security.SecurityHeadersMiddleware) -----


@pytest.mark.django_db
def test_csp_and_permissions_policy_on_a_normal_response(client):
    resp = client.get("/robots.txt")
    assert "Content-Security-Policy" in resp
    csp = resp["Content-Security-Policy"]
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp
    assert "object-src 'none'" in csp
    assert "script-src 'self'" in csp and "'unsafe-inline'" not in csp.split("style-src")[0]
    assert resp["Permissions-Policy"].startswith("accelerometer=()")


@pytest.mark.django_db
def test_csp_is_skipped_for_the_api_docs(client):
    # Swagger UI pulls assets from a CDN and is internal tooling.
    resp = client.get("/api/schema/")
    assert "Content-Security-Policy" not in resp


@pytest.mark.django_db
def test_csp_report_only_toggle(client, settings):
    settings.CSP_REPORT_ONLY = True
    resp = client.get("/robots.txt")
    assert "Content-Security-Policy-Report-Only" in resp
    assert "Content-Security-Policy" not in resp


@pytest.mark.django_db
def test_api_json_response_also_carries_csp(client):
    resp = client.get("/api/v1/services/")
    assert resp.status_code == 200
    assert "Content-Security-Policy" in resp


# --- baseline throttling (DEFAULT_THROTTLE_CLASSES) ----------------


@pytest.fixture
def tight_rates(monkeypatch):
    """Shrink the anon/user ceilings for the duration of a test. Both
    throttle classes read the same `THROTTLE_RATES` dict."""
    from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

    for cls in (AnonRateThrottle, UserRateThrottle):
        monkeypatch.setitem(cls.THROTTLE_RATES, "anon", "5/min")
        monkeypatch.setitem(cls.THROTTLE_RATES, "user", "20/min")


@pytest.mark.django_db
def test_service_endpoint_is_normally_unthrottled():
    """Sanity: without a tight ceiling, the default anon rate (120/min)
    does not trip on a handful of requests."""
    api = APIClient()
    assert all(api.get("/api/v1/services/").status_code == 200 for _ in range(10))


@pytest.mark.django_db
def test_anonymous_traffic_hits_the_baseline_throttle(tight_rates):
    api = APIClient()
    codes = [api.get("/api/v1/services/").status_code for _ in range(7)]
    assert codes.count(200) == 5
    assert codes[-1] == 429


@pytest.mark.django_db
def test_authenticated_users_get_the_higher_ceiling(tight_rates, django_user_model):
    user = django_user_model.objects.create_user(email="u@mds.example", password="x")
    api = APIClient()
    api.force_login(user)
    # 6 requests: past the anon ceiling (5) but well under the user one (20)
    codes = [api.get("/api/v1/services/").status_code for _ in range(6)]
    assert codes.count(200) == 6
