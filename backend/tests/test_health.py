"""Boot smoke + readiness gating (docs/DEPLOYMENT.md, Phase 16)."""
import pytest
from django.test import Client


def test_health_endpoint_is_dependency_free():
    response = Client().get("/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_ready_reports_every_dependency():
    body = Client().get("/ready/").json()
    assert set(body["checks"]) == {"database", "cache", "migrations", "broker"}


@pytest.mark.django_db
def test_ready_is_200_when_db_cache_and_migrations_are_ok():
    response = Client().get("/ready/")
    # DB (sqlite) + cache (locmem) + migrations (pytest applied them) are
    # all up in the test env; the broker is informational.
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["checks"]["migrations"] == "ok"


@pytest.mark.django_db
def test_ready_is_503_when_a_gating_check_fails(monkeypatch):
    monkeypatch.setattr("config.health._check_cache", lambda: "unavailable")
    response = Client().get("/ready/")
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"


@pytest.mark.django_db
def test_pending_migrations_block_readiness(monkeypatch):
    monkeypatch.setattr("config.health._check_migrations", lambda: "pending")
    assert Client().get("/ready/").status_code == 503
