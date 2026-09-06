"""
Model/service tests for the quote reference generator
(docs/DATABASE_DESIGN.md "quotations") — the one piece of Phase 2 logic
with real concurrency risk (spec §17 "idempotency protection").
"""
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import IntegrityError, connection, connections
from django.utils import timezone

from .models import QuoteRequest
from .services import create_quote_request, generate_quote_reference


@pytest.mark.django_db
def test_generate_quote_reference_format():
    reference = generate_quote_reference(year=2026)
    assert reference == "MDS-Q-2026-000001"


@pytest.mark.django_db
def test_generate_quote_reference_increments_per_year():
    first = generate_quote_reference(year=2026)
    second = generate_quote_reference(year=2026)
    third = generate_quote_reference(year=2027)  # separate counter per year

    assert first == "MDS-Q-2026-000001"
    assert second == "MDS-Q-2026-000002"
    assert third == "MDS-Q-2027-000001"


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason=(
        "SQLite has no real row-level locking (whole-database write lock), "
        "so this only meaningfully verifies select_for_update() against "
        "Postgres — run with DATABASE_URL pointed at Postgres, or in CI "
        "once Phase 13 adds a Postgres service container."
    ),
)
def test_generate_quote_reference_is_unique_under_concurrency():
    """Two threads racing for the same year's counter must never receive
    the same reference number — the failure mode this test guards
    against is a duplicate `public_reference` from `count() + 1`-style
    logic instead of a locked counter row."""

    def _generate():
        try:
            return generate_quote_reference(year=2026)
        finally:
            connections.close_all()  # each thread needs its own DB connection

    with ThreadPoolExecutor(max_workers=8) as pool:
        references = list(pool.map(lambda _: _generate(), range(8)))

    assert len(references) == len(set(references)) == 8


@pytest.mark.django_db
def test_create_quote_request_assigns_reference_and_persists():
    quote = create_quote_request(name="Jane Doe", email="jane@example.com", message="Need a quote.")
    assert quote.pk is not None
    assert quote.public_reference.startswith(f"MDS-Q-{timezone.now().year}-")


@pytest.mark.django_db
def test_public_reference_must_be_unique():
    QuoteRequest.objects.create(
        public_reference="MDS-Q-2026-000001", name="A", email="a@example.com", message="x"
    )
    with pytest.raises(IntegrityError):
        QuoteRequest.objects.create(
            public_reference="MDS-Q-2026-000001", name="B", email="b@example.com", message="y"
        )
