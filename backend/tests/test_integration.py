"""
Phase 13 — cross-cutting integration flows (docs/TESTING.md "Integration
tests"). Each test walks a whole multi-step journey and asserts the
side effects at every hop: state change, audit row, version snapshot,
notification, download log.
"""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.documents.models import DownloadLog, ProcessingStatus
from apps.notifications.models import NotificationLog
from apps.pages.models import ContentVersion, PublishStatus
from apps.services.models import Service

User = get_user_model()
PDF = b"%PDF-1.4\n%%EOF\n"


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


# --- publishing workflow: draft -> review -> approved -> published ----


@pytest.mark.django_db
def test_service_publishing_workflow_end_to_end(api):
    editor = grant(
        User.objects.create_user(email="ed@mds.example", password="x"),
        "add_service", "change_service", "view_service",
    )
    publisher = grant(
        User.objects.create_user(email="pub@mds.example", password="x"),
        "change_service", "view_service", "publish_service",
    )
    PUBLIC = "/api/v1/services/"
    ADMIN = "/api/v1/admin/services/"

    # editor creates a draft
    api.force_login(editor)
    created = api.post(
        ADMIN,
        {"name": "Rebar Detailing", "slug": "rebar-detailing", "short_description": "Shop drawings."},
        format="json",
    )
    assert created.status_code == 201
    svc_id = created.json()["data"]["id"]
    svc = Service.objects.get(pk=svc_id)
    assert svc.status == PublishStatus.DRAFT
    assert ContentVersion.objects.filter(object_id=svc_id).count() == 1  # snapshot on create

    # not visible to the public yet
    assert api.get(f"{PUBLIC}rebar-detailing/").status_code == 404

    # editor moves draft -> review, then review -> approved
    def transition(to):
        return api.post(f"{ADMIN}{svc_id}/transition/", {"to": to}, format="json")

    assert transition("review").status_code == 200
    assert transition("approved").status_code == 200
    svc.refresh_from_db()
    assert svc.status == PublishStatus.APPROVED

    # editor cannot publish — needs publish_service
    assert transition("published").status_code == 403

    # publisher takes it live
    api.force_login(publisher)
    assert transition("published").status_code == 200
    svc.refresh_from_db()
    assert svc.status == PublishStatus.PUBLISHED

    # now public
    pub = api.get(f"{PUBLIC}rebar-detailing/")
    assert pub.status_code == 200
    assert pub.json()["data"]["name"] == "Rebar Detailing"

    # every successful transition left an audit row and a version snapshot
    actions = list(
        AuditLog.objects.filter(entity_type="services.service", entity_id=str(svc_id))
        .order_by("timestamp")
        .values_list("action", flat=True)
    )
    assert actions == ["content.review", "content.approved", "content.published"]
    # create + 3 transition snapshots
    assert ContentVersion.objects.filter(object_id=svc_id).count() == 4


# --- quote submission -> notification -> assignment -> close ---------


@pytest.mark.django_db
def test_quote_request_lifecycle(api, settings):
    settings.SALES_NOTIFICATION_EMAIL = "sales@mds.example"
    SUBMIT = "/api/v1/quote-requests/"
    ADMIN = "/api/v1/admin/quote-requests/"

    # public submission
    resp = api.post(
        SUBMIT,
        {"name": "Jane Roe", "email": "jane@example.com", "company": "ACME",
         "project_type": "Bridge", "message": "Need pricing."},
        format="json",
        HTTP_IDEMPOTENCY_KEY="quote-key-1",
    )
    assert resp.status_code == 201
    reference = resp.json()["data"]["reference"]
    assert reference.startswith("MDS-Q-")

    # audit + both notifications (acknowledgement + internal)
    assert AuditLog.objects.filter(action="quote_request.submitted").count() == 1
    templates = set(NotificationLog.objects.values_list("template", flat=True))
    assert templates == {"quote_request_acknowledgement", "quote_request_internal"}
    assert {addr for m in mail.outbox for addr in m.to} >= {"jane@example.com", "sales@mds.example"}

    # replay with the same Idempotency-Key -> same record, nothing new
    replay = api.post(SUBMIT, {"name": "x", "email": "y@z.com", "message": "m"}, format="json",
                      HTTP_IDEMPOTENCY_KEY="quote-key-1")
    assert replay.json()["data"]["reference"] == reference
    from apps.quotations.models import QuoteRequest

    quote = QuoteRequest.objects.get()

    # BD assigns then closes — each gated on its own permission, each audited
    bd = User.objects.create_user(email="bd@mds.example", password="x")
    api.force_login(grant(bd, "view_quoterequest", "change_quoterequest"))
    assert api.patch(f"{ADMIN}{quote.pk}/", {"status": "assigned"}, format="json").status_code == 403

    api.force_login(grant(bd, "assign_quoterequest"))
    assert api.patch(f"{ADMIN}{quote.pk}/", {"status": "assigned", "assigned_to": bd.pk},
                     format="json").status_code == 200

    assert api.patch(f"{ADMIN}{quote.pk}/", {"status": "closed"}, format="json").status_code == 403
    api.force_login(grant(bd, "close_quoterequest"))
    assert api.patch(f"{ADMIN}{quote.pk}/", {"status": "closed"}, format="json").status_code == 200

    quote.refresh_from_db()
    assert quote.status == "closed" and quote.assigned_to_id == bd.pk
    assert AuditLog.objects.filter(action="quote_request.updated").count() == 2


# --- upload -> scan -> authorized download --------------------------


@pytest.mark.django_db
def test_document_upload_and_private_download_flow(api):
    uploader = grant(
        User.objects.create_user(email="up@mds.example", password="x"), "add_document"
    )
    api.force_login(uploader)

    ticket = api.post(
        "/api/v1/admin/documents/upload/",
        {"category": "document", "filename": "spec.pdf", "size": len(PDF),
         "content_type": "application/pdf", "visibility": "private"},
        format="json",
    ).json()["data"]
    doc_uuid = ticket["document"]

    # client PUTs the bytes to the signed URL, then completes
    assert api.put(ticket["upload"]["url"], data=PDF, content_type="application/pdf").status_code == 200
    assert api.post(f"/api/v1/admin/documents/{doc_uuid}/complete/").status_code == 200

    from apps.documents.models import Document

    doc = Document.objects.get(uuid=doc_uuid)
    assert doc.status == ProcessingStatus.PROCESSED and doc.checksum

    # anonymous cannot get a download URL for a private doc
    anon = APIClient()
    assert anon.get(f"/api/v1/documents/{doc_uuid}/download/").status_code == 403

    # a viewer can — and it is logged + the URL actually serves the bytes
    viewer = grant(User.objects.create_user(email="v@mds.example", password="x"), "view_document")
    api.force_login(viewer)
    dl = api.get(f"/api/v1/documents/{doc_uuid}/download/")
    assert dl.status_code == 200
    served = api.get(dl.json()["data"]["url"])
    assert b"".join(served.streaming_content) == PDF
    assert DownloadLog.objects.filter(document=doc, user=viewer).count() == 1
    assert AuditLog.objects.filter(action="document.downloaded", entity_id=str(doc.pk)).exists()


# --- career application -> résumé stored + scanned -> HR download ----


@pytest.mark.django_db
def test_career_application_flow(api, settings):
    settings.CAREERS_NOTIFICATION_EMAIL = "hr@mds.example"
    from apps.careers.models import JobPosting

    JobPosting.objects.create(title="Detailer", slug="detailer", is_active=True)

    resp = api.post(
        "/api/v1/career-applications/",
        {"job": "detailer", "name": "Sam Lee", "email": "sam@example.com",
         "resume": SimpleUploadedFile("cv.pdf", PDF, content_type="application/pdf")},
        format="multipart",
    )
    assert resp.status_code == 201
    from apps.applications.models import JobApplication

    application = JobApplication.objects.get()
    assert application.resume.status == ProcessingStatus.PROCESSED  # eager scan
    assert application.resume.object_key.startswith("private/resumes/")
    assert AuditLog.objects.filter(action="application.submitted").exists()
    assert NotificationLog.objects.filter(template="job_application_internal").exists()

    # HR pulls the résumé through the authorized, logged path
    hr = grant(
        User.objects.create_user(email="hr2@mds.example", password="x"), "view_jobapplication"
    )
    api.force_login(hr)
    dl = api.get(f"/api/v1/admin/career-applications/{application.pk}/resume/")
    assert dl.status_code == 200
    served = api.get(dl.json()["data"]["url"])
    assert b"".join(served.streaming_content) == PDF
    assert DownloadLog.objects.filter(document=application.resume, user=hr).count() == 1
