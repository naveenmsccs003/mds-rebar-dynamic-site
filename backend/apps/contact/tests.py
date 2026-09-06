import pytest
from django.db import IntegrityError

from .models import Enquiry
from .services import create_enquiry, generate_enquiry_reference


@pytest.mark.django_db
def test_generate_enquiry_reference_format():
    assert generate_enquiry_reference(year=2026) == "MDS-E-2026-000001"


@pytest.mark.django_db
def test_generate_enquiry_reference_increments():
    assert generate_enquiry_reference(year=2026) == "MDS-E-2026-000001"
    assert generate_enquiry_reference(year=2026) == "MDS-E-2026-000002"


@pytest.mark.django_db
def test_create_enquiry_assigns_reference_and_defaults_to_new_status():
    enquiry = create_enquiry(name="Jane", email="jane@example.com", message="Hello")
    assert enquiry.public_reference.startswith("MDS-E-")
    assert enquiry.status == "new"


@pytest.mark.django_db
def test_public_reference_must_be_unique():
    Enquiry.objects.create(public_reference="MDS-E-2026-000001", name="A", email="a@example.com", message="x")
    with pytest.raises(IntegrityError):
        Enquiry.objects.create(public_reference="MDS-E-2026-000001", name="B", email="b@example.com", message="y")


# --- Phase 9: public submission + admin workflow -----------------------

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core import mail
from rest_framework.test import APIClient

from apps.audit.models import AuditLog

User = get_user_model()
SUBMIT = "/api/v1/contact/"
ADMIN = "/api/v1/admin/enquiries/"


def _grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def enquiry(db):
    return create_enquiry(name="Jane", email="jane@example.com", message="Hello there")


@pytest.mark.django_db
def test_submit_creates_enquiry_with_reference_and_emails(api, settings):
    settings.SALES_NOTIFICATION_EMAIL = "sales@mds.example"
    resp = api.post(
        SUBMIT,
        {"name": "Jane", "email": "jane@example.com", "message": "<i>Hello</i> there",
         "enquiry_type": "business"},
        format="json",
    )
    assert resp.status_code == 201
    ref = resp.json()["data"]["reference"]
    assert ref.startswith("MDS-E-")
    enquiry = Enquiry.objects.get(public_reference=ref)
    assert enquiry.message == "Hello there"
    assert enquiry.enquiry_type == "business"
    assert AuditLog.objects.filter(action="enquiry.submitted", entity_id=str(enquiry.pk)).exists()
    recipients = {addr for m in mail.outbox for addr in m.to}
    assert {"jane@example.com", "sales@mds.example"} <= recipients


@pytest.mark.django_db
def test_message_is_required(api, db):
    resp = api.post(SUBMIT, {"name": "Jane", "email": "jane@example.com"}, format="json")
    assert resp.status_code == 400
    assert "message" in resp.json()["error"]["fields"]


@pytest.mark.django_db
def test_honeypot_and_dedupe(api, db):
    assert api.post(SUBMIT, {"name": "B", "email": "b@x.com", "message": "m", "website": "x"},
                    format="json").status_code == 201
    assert Enquiry.objects.count() == 0

    api.post(SUBMIT, {"name": "A", "email": "a@x.com", "message": "same"}, format="json")
    api.post(SUBMIT, {"name": "A", "email": "a@x.com", "message": "same"}, format="json")
    assert Enquiry.objects.count() == 1


@pytest.mark.django_db
def test_submit_is_throttled(api, db):
    last = None
    for _ in range(11):
        last = api.post(SUBMIT, {"name": "x", "email": "x@x.com", "message": "m", "website": "z"},
                        format="json")
    assert last.status_code == 429


@pytest.mark.django_db
def test_admin_respond_needs_respond_permission(api, enquiry):
    user = User.objects.create_user(email="bd@mds.example", password="x")
    api.force_login(_grant(user, "view_enquiry", "change_enquiry", "assign_enquiry"))
    api.patch(f"{ADMIN}{enquiry.pk}/", {"status": "in_progress"}, format="json")
    assert api.patch(f"{ADMIN}{enquiry.pk}/", {"status": "responded"}, format="json").status_code == 403
    api.force_login(_grant(user, "respond_enquiry"))
    assert api.patch(f"{ADMIN}{enquiry.pk}/", {"status": "responded"}, format="json").status_code == 200
    assert AuditLog.objects.filter(action="enquiry.updated", entity_id=str(enquiry.pk)).exists()


@pytest.mark.django_db
def test_admin_invalid_transition_rejected(api, enquiry):
    user = User.objects.create_user(email="bd@mds.example", password="x")
    api.force_login(_grant(user, "view_enquiry", "change_enquiry", "close_enquiry"))
    api.patch(f"{ADMIN}{enquiry.pk}/", {"status": "closed"}, format="json")
    # closed -> responded is not allowed
    resp = api.patch(f"{ADMIN}{enquiry.pk}/", {"status": "responded"}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_TRANSITION"


@pytest.mark.django_db
def test_admin_notes_are_appendable_and_permissioned(api, enquiry):
    reader = User.objects.create_user(email="r@mds.example", password="x")
    api.force_login(_grant(reader, "view_enquiry"))
    assert api.get(f"{ADMIN}{enquiry.pk}/notes/").status_code == 200
    assert api.post(f"{ADMIN}{enquiry.pk}/notes/", {"note": "called back"}, format="json").status_code == 403

    editor = User.objects.create_user(email="e@mds.example", password="x")
    api.force_login(_grant(editor, "view_enquiry", "change_enquiry"))
    resp = api.post(f"{ADMIN}{enquiry.pk}/notes/", {"note": "called back"}, format="json")
    assert resp.status_code == 201
    assert resp.json()["data"]["author_email"] == "e@mds.example"
    assert enquiry.notes.count() == 1
