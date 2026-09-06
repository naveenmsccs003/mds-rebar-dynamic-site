"""Phase 8 — Job applications: public submission + résumé upload security + admin workflow."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.careers.models import JobPosting
from apps.documents.models import Document, ProcessingStatus, Visibility

from .models import ApplicationStatus, JobApplication

User = get_user_model()

SUBMIT = "/api/v1/career-applications/"
ADMIN = "/api/v1/admin/career-applications/"

PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
DOCX_BYTES = b"PK\x03\x04" + b"\x00" * 40


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


def resume(name="cv.pdf", content=PDF_BYTES, content_type="application/pdf"):
    return SimpleUploadedFile(name, content, content_type=content_type)


def form(job, **overrides):
    data = {
        "job": job.slug,
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+971500000000",
        "cover_letter": "I would like to apply.",
        "resume": resume(),
    }
    data.update(overrides)
    return data


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def job(db):
    return JobPosting.objects.create(title="Rebar Detailer", slug="rebar-detailer", is_active=True)


# --- model ---------------------------------------------------------------


@pytest.mark.django_db
def test_defaults_to_new_status(job):
    application = JobApplication.objects.create(job=job, name="Jane Doe", email="jane@example.com")
    assert application.status == ApplicationStatus.NEW
    assert application.uuid is not None


# --- public submission -----------------------------------------------


@pytest.mark.django_db
def test_submit_stores_private_pending_document_and_audits(api, job):
    resp = api.post(SUBMIT, form(job), format="multipart")
    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] == ApplicationStatus.NEW

    application = JobApplication.objects.get(uuid=body["data"]["reference"])
    assert application.email == "jane@example.com"
    assert application.ip_address is not None

    doc = application.resume
    assert doc.visibility == Visibility.PRIVATE
    assert doc.status == ProcessingStatus.PENDING
    assert doc.original_filename == "cv.pdf"
    assert doc.object_key.startswith("private/resumes/")
    assert doc.object_key != "cv.pdf" and "cv" not in doc.object_key
    assert len(doc.checksum) == 64

    assert AuditLog.objects.filter(
        action="application.submitted", entity_id=str(application.pk)
    ).exists()


@pytest.mark.django_db
def test_submit_accepts_docx(api, job):
    resp = api.post(
        SUBMIT,
        form(job, resume=resume("cv.docx", DOCX_BYTES, "application/octet-stream")),
        format="multipart",
    )
    assert resp.status_code == 201


@pytest.mark.django_db
def test_submit_rejects_disallowed_extension(api, job):
    resp = api.post(
        SUBMIT, form(job, resume=resume("cv.exe", b"MZ...", "application/octet-stream")),
        format="multipart",
    )
    assert resp.status_code == 400
    assert "resume" in resp.json()["error"]["fields"]
    assert JobApplication.objects.count() == 0
    assert Document.objects.count() == 0


@pytest.mark.django_db
def test_submit_rejects_content_type_mismatch(api, job):
    # A .pdf name whose bytes are not a PDF (e.g. an HTML/script payload).
    resp = api.post(
        SUBMIT, form(job, resume=resume("cv.pdf", b"<html><script>x</script></html>")),
        format="multipart",
    )
    assert resp.status_code == 400
    assert JobApplication.objects.count() == 0


@pytest.mark.django_db
def test_submit_rejects_oversize(api, job, settings):
    settings.RESUME_UPLOAD_MAX_BYTES = 1024
    big = PDF_BYTES + b"0" * 2048
    resp = api.post(SUBMIT, form(job, resume=resume("cv.pdf", big)), format="multipart")
    assert resp.status_code == 400
    assert JobApplication.objects.count() == 0


@pytest.mark.django_db
def test_submit_strips_markup_from_free_text(api, job):
    resp = api.post(
        SUBMIT,
        form(job, cover_letter="<script>alert(1)</script>Hello", name="<b>Jane</b> Doe"),
        format="multipart",
    )
    assert resp.status_code == 201
    application = JobApplication.objects.get()
    assert "<script>" not in application.cover_letter
    assert application.cover_letter.endswith("Hello")
    assert application.name == "Jane Doe"


@pytest.mark.django_db
def test_honeypot_returns_fake_success_and_creates_nothing(api, job):
    resp = api.post(SUBMIT, form(job, website="http://spam.example"), format="multipart")
    assert resp.status_code == 201
    assert resp.json()["data"]["reference"] is None
    assert JobApplication.objects.count() == 0
    assert Document.objects.count() == 0


@pytest.mark.django_db
def test_closed_posting_is_refused(api, db):
    from datetime import timedelta

    from django.utils import timezone

    closed = JobPosting.objects.create(
        title="Old", slug="old", is_active=True,
        application_deadline=timezone.now().date() - timedelta(days=1),
    )
    resp = api.post(SUBMIT, form(closed), format="multipart")
    assert resp.status_code == 200
    assert resp.json()["data"]["reference"] is None
    assert JobApplication.objects.count() == 0


@pytest.mark.django_db
def test_inactive_posting_is_rejected_by_serializer(api, db):
    inactive = JobPosting.objects.create(title="Nope", slug="nope", is_active=False)
    resp = api.post(SUBMIT, form(inactive), format="multipart")
    assert resp.status_code == 400
    assert "job" in resp.json()["error"]["fields"]


@pytest.mark.django_db
def test_idempotency_key_replay_returns_same_application(api, job):
    headers = {"HTTP_IDEMPOTENCY_KEY": "abc-123"}
    first = api.post(SUBMIT, form(job), format="multipart", **headers)
    second = api.post(SUBMIT, form(job, email="other@example.com"), format="multipart", **headers)
    assert first.status_code == second.status_code == 201
    assert first.json()["data"]["reference"] == second.json()["data"]["reference"]
    assert JobApplication.objects.count() == 1


@pytest.mark.django_db
def test_duplicate_same_job_and_email_is_not_recreated(api, job):
    first = api.post(SUBMIT, form(job), format="multipart")
    second = api.post(SUBMIT, form(job), format="multipart")
    assert first.status_code == second.status_code == 201
    assert "already received" in second.json()["message"].lower()
    assert JobApplication.objects.count() == 1


@pytest.mark.django_db
def test_submit_is_throttled(api, job):
    last = None
    for _ in range(11):
        last = api.post(SUBMIT, form(job, website="x@spam.example"), format="multipart")
    assert last.status_code == 429


# --- admin workflow ------------------------------------------------


@pytest.fixture
def application(job):
    doc = Document.objects.create(
        object_key="private/resumes/deadbeef.pdf", original_filename="cv.pdf",
        content_type="application/pdf", size_bytes=10, visibility=Visibility.PRIVATE,
    )
    return JobApplication.objects.create(
        job=job, name="Jane Doe", email="jane@example.com", resume=doc,
    )


@pytest.fixture
def reviewer(db):
    return grant(
        User.objects.create_user(email="hr@mds.example", password="x"),
        "view_jobapplication", "change_jobapplication",
    )


@pytest.mark.django_db
def test_admin_list_requires_auth_then_permission(api, application):
    assert api.get(ADMIN).status_code == 401
    plain = User.objects.create_user(email="p@mds.example", password="x")
    api.force_login(plain)
    assert api.get(ADMIN).status_code == 403


@pytest.mark.django_db
def test_admin_has_no_create_endpoint(api, reviewer, job):
    api.force_login(reviewer)
    assert api.post(ADMIN, {"job": job.pk, "name": "x", "email": "x@x.com"}, format="json").status_code == 405


@pytest.mark.django_db
def test_admin_can_change_status_and_it_is_audited(api, reviewer, application):
    api.force_login(reviewer)
    resp = api.patch(
        f"{ADMIN}{application.pk}/",
        {"status": ApplicationStatus.SHORTLISTED, "name": "Hacked"},
        format="json",
    )
    assert resp.status_code == 200
    application.refresh_from_db()
    assert application.status == ApplicationStatus.SHORTLISTED
    assert application.name == "Jane Doe"  # applicant fields are read-only
    assert AuditLog.objects.filter(
        action="application.updated", entity_id=str(application.pk)
    ).exists()


@pytest.mark.django_db
def test_admin_detail_exposes_no_download_url(api, reviewer, application):
    api.force_login(reviewer)
    data = api.get(f"{ADMIN}{application.pk}/").json()["data"]
    assert data["resume_filename"] == "cv.pdf"
    assert "url" not in str(data).lower() or data.get("resume") == application.resume_id
    assert data["resume_status"] == ProcessingStatus.PENDING


@pytest.mark.django_db
def test_admin_delete_needs_delete_permission(api, reviewer, application):
    api.force_login(reviewer)
    assert api.delete(f"{ADMIN}{application.pk}/").status_code == 403
    api.force_login(grant(reviewer, "delete_jobapplication"))
    assert api.delete(f"{ADMIN}{application.pk}/").status_code == 204
