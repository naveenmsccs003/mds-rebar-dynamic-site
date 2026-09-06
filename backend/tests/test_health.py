"""Phase 1 smoke test: the project boots and the health endpoints work."""
import pytest
from django.test import Client


def test_health_endpoint():
    response = Client().get("/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_ready_endpoint_reports_dependency_status():
    response = Client().get("/ready/")
    assert response.status_code in (200, 503)
    assert "checks" in response.json()
