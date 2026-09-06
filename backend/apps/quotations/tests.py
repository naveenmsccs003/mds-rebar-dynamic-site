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


# --- Phase 9: public submission + admin workflow -----------------------

from django.contrib.auth import get_user_model  # noqa: E402
from django.contrib.auth.models import Permission  # noqa: E402
from django.core import mail  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from apps.audit.models import AuditLog  # noqa: E402
from apps.markets.models import Country  # noqa: E402
from apps.pages.models import PublishStatus  # noqa: E402
from apps.services.models import Service  # noqa: E402

User = get_user_model()
SUBMIT = "/api/v1/quote-requests/"
ADMIN = "/api/v1/admin/quote-requests/"


def _grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def published_service(db):
    return Service.objects.create(name="Rebar Detailing", slug="rebar-detailing",
                                  status=PublishStatus.PUBLISHED)


@pytest.fixture
def quote(db):
    return create_quote_request(name="Jane Doe", email="jane@example.com", message="Need a quote.")


@pytest.mark.django_db
def test_submit_creates_request_with_reference_and_emails(api, published_service, settings):
    settings.SALES_NOTIFICATION_EMAIL = "sales@mds.example"
    body = {
        "name": "Jane Doe", "email": "jane@example.com", "company": "ACME",
        "service": "rebar-detailing", "required_services": ["rebar-detailing"],
        "project_type": "Bridge", "message": "<b>Need</b> a quote",
    }
    resp = api.post(SUBMIT, body, format="json")
    assert resp.status_code == 201
    ref = resp.json()["data"]["reference"]
    assert ref.startswith("MDS-Q-")

    quote = QuoteRequest.objects.get(public_reference=ref)
    assert quote.service_id == published_service.id
    assert list(quote.required_services.values_list("slug", flat=True)) == ["rebar-detailing"]
    assert quote.message == "Need a quote"  # tags stripped
    assert quote.ip_address is not None
    assert AuditLog.objects.filter(action="quote_request.submitted", entity_id=str(quote.pk)).exists()
    # acknowledgement to the requester + internal alert
    recipients = {addr for m in mail.outbox for addr in m.to}
    assert {"jane@example.com", "sales@mds.example"} <= recipients


@pytest.mark.django_db
def test_submit_rejects_unpublished_service(api, db):
    Service.objects.create(name="Draft Svc", slug="draft-svc", status=PublishStatus.DRAFT)
    resp = api.post(SUBMIT, {"name": "J", "email": "j@x.com", "service": "draft-svc"}, format="json")
    assert resp.status_code == 400
    assert "service" in resp.json()["error"]["fields"]


@pytest.mark.django_db
def test_honeypot_and_idempotency_and_dedupe(api, db):
    # honeypot -> fake success, nothing stored
    assert api.post(SUBMIT, {"name": "B", "email": "b@x.com", "website": "x"}, format="json").status_code == 201
    assert QuoteRequest.objects.count() == 0

    hdr = {"HTTP_IDEMPOTENCY_KEY": "key-1"}
    r1 = api.post(SUBMIT, {"name": "A", "email": "a@x.com", "message": "m"}, format="json", **hdr)
    r2 = api.post(SUBMIT, {"name": "A", "email": "a@x.com", "message": "m2"}, format="json", **hdr)
    assert r1.json()["data"]["reference"] == r2.json()["data"]["reference"]
    assert QuoteRequest.objects.count() == 1

    # same email within the window, no key -> coalesced
    api.post(SUBMIT, {"name": "A", "email": "a@x.com", "message": "again"}, format="json")
    assert QuoteRequest.objects.count() == 1


@pytest.mark.django_db
def test_submit_is_throttled(api, db):
    last = None
    for _ in range(11):
        last = api.post(SUBMIT, {"name": "x", "email": "x@x.com", "website": "z"}, format="json")
    assert last.status_code == 429


@pytest.mark.django_db
def test_admin_list_requires_permission(api, quote):
    assert api.get(ADMIN).status_code == 401
    plain = User.objects.create_user(email="p@mds.example", password="x")
    api.force_login(plain)
    assert api.get(ADMIN).status_code == 403
    api.force_login(_grant(plain, "view_quoterequest"))
    assert api.get(ADMIN).status_code == 200


@pytest.mark.django_db
def test_admin_assign_needs_assign_permission_and_is_audited(api, quote):
    user = User.objects.create_user(email="bd@mds.example", password="x")
    api.force_login(_grant(user, "view_quoterequest", "change_quoterequest"))
    # moving to ASSIGNED needs assign_quoterequest
    resp = api.patch(f"{ADMIN}{quote.pk}/", {"status": "assigned"}, format="json")
    assert resp.status_code == 403

    api.force_login(_grant(user, "assign_quoterequest"))
    resp = api.patch(f"{ADMIN}{quote.pk}/", {"status": "assigned", "assigned_to": user.pk}, format="json")
    assert resp.status_code == 200
    quote.refresh_from_db()
    assert quote.status == "assigned" and quote.assigned_to_id == user.pk
    assert AuditLog.objects.filter(action="quote_request.updated", entity_id=str(quote.pk)).exists()


@pytest.mark.django_db
def test_admin_close_needs_close_permission(api, quote):
    user = User.objects.create_user(email="bd@mds.example", password="x")
    api.force_login(_grant(user, "view_quoterequest", "change_quoterequest", "assign_quoterequest"))
    api.patch(f"{ADMIN}{quote.pk}/", {"status": "in_progress"}, format="json")
    assert api.patch(f"{ADMIN}{quote.pk}/", {"status": "closed"}, format="json").status_code == 403
    api.force_login(_grant(user, "close_quoterequest"))
    assert api.patch(f"{ADMIN}{quote.pk}/", {"status": "closed"}, format="json").status_code == 200


@pytest.mark.django_db
def test_admin_cannot_edit_requester_fields(api, quote):
    user = User.objects.create_user(email="bd@mds.example", password="x")
    api.force_login(_grant(user, "view_quoterequest", "change_quoterequest"))
    api.patch(f"{ADMIN}{quote.pk}/", {"name": "Hacked", "email": "z@z.com"}, format="json")
    quote.refresh_from_db()
    assert quote.name == "Jane Doe" and quote.email == "jane@example.com"


@pytest.mark.django_db
def test_admin_has_no_create_or_delete(api, quote):
    user = User.objects.create_user(email="bd@mds.example", password="x")
    api.force_login(_grant(user, "view_quoterequest", "change_quoterequest", "add_quoterequest",
                           "delete_quoterequest"))
    assert api.post(ADMIN, {"name": "x", "email": "x@x.com"}, format="json").status_code == 405
    assert api.delete(f"{ADMIN}{quote.pk}/").status_code == 405
