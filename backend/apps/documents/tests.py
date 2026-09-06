import pytest
from django.db import IntegrityError

from .models import Document, DownloadLog, Visibility


@pytest.mark.django_db
def test_document_defaults_to_private_visibility():
    """docs/SECURITY.md: private-by-default so a forgotten visibility
    field never accidentally exposes an upload publicly."""
    document = Document.objects.create(
        object_key="a1b2c3d4e5f6",
        original_filename="resume.pdf",
        content_type="application/pdf",
        size_bytes=1024,
    )
    assert document.visibility == Visibility.PRIVATE


@pytest.mark.django_db
def test_object_key_must_be_unique():
    Document.objects.create(
        object_key="dup-key", original_filename="a.pdf", content_type="application/pdf", size_bytes=1
    )
    with pytest.raises(IntegrityError):
        Document.objects.create(
            object_key="dup-key", original_filename="b.pdf", content_type="application/pdf", size_bytes=1
        )


@pytest.mark.django_db
def test_download_log_records_access():
    document = Document.objects.create(
        object_key="k1", original_filename="resume.pdf", content_type="application/pdf", size_bytes=10
    )
    log = DownloadLog.objects.create(document=document, ip_address="127.0.0.1")
    assert document.download_logs.count() == 1
    assert log.document == document


# --- Phase 10: storage abstraction + upload / download flow -----------

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.audit.models import AuditLog

from .models import ProcessingStatus
from .services import can_download, store_bytes
from .storage import LocalSignedStorage, TokenExpired, get_storage

User = get_user_model()
PDF = b"%PDF-1.4\n%%EOF\n"
UPLOAD = "/api/v1/admin/documents/upload/"


def _grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def uploader(db):
    return _grant(User.objects.create_user(email="up@mds.example", password="x"), "add_document")


def _stored(visibility=Visibility.PRIVATE, status=ProcessingStatus.PROCESSED, owner=None):
    doc = store_bytes(
        category="document",
        uploaded_file=SimpleUploadedFile("report.pdf", PDF, content_type="application/pdf"),
        owner=owner,
        visibility=visibility,
    )
    doc.status = status
    doc.save(update_fields=["status"])
    return doc


# --- storage round trip --------------------------------------------


@pytest.mark.django_db
def test_local_storage_round_trip_and_signed_urls():
    storage = get_storage()
    key = storage.save("private/documents/x.pdf", PDF)
    assert storage.exists(key)
    with storage.open(key) as fh:
        assert fh.read() == PDF

    signed = storage.signed_download_url(key, filename="x.pdf", expires_in=300)
    k, name = LocalSignedStorage.verify_download_token(signed.rsplit("/d/", 1)[1].rstrip("/"), max_age=300)
    assert k == key and name == "x.pdf"


@pytest.mark.django_db
def test_expired_download_token_is_rejected():
    storage = get_storage()
    storage.save("private/documents/y.pdf", PDF)
    signed = storage.signed_download_url("private/documents/y.pdf", filename="y.pdf", expires_in=300)
    token = signed.rsplit("/d/", 1)[1].rstrip("/")
    with pytest.raises(TokenExpired):
        LocalSignedStorage.verify_download_token(token, max_age=-1)


# --- validation ------------------------------------------------------


@pytest.mark.django_db
def test_store_bytes_rejects_bad_extension_and_content_mismatch():
    from .validation import UploadValidationError

    with pytest.raises(UploadValidationError):
        store_bytes(category="document",
                    uploaded_file=SimpleUploadedFile("a.exe", b"MZ..", content_type="x"))
    with pytest.raises(UploadValidationError):
        store_bytes(category="document",
                    uploaded_file=SimpleUploadedFile("a.pdf", b"<html>no</html>", content_type="application/pdf"))


# --- presigned-style upload flow ---------------------------------


@pytest.mark.django_db
def test_upload_flow_needs_permission():
    api = APIClient()
    assert api.post(UPLOAD, {"category": "image", "filename": "a.png", "size": 10}, format="json").status_code == 401
    plain = User.objects.create_user(email="p@mds.example", password="x")
    api.force_login(plain)
    assert api.post(UPLOAD, {"category": "image", "filename": "a.png", "size": 10}, format="json").status_code == 403


@pytest.mark.django_db
def test_upload_ticket_then_put_then_complete_then_scan(api, uploader):
    api.force_login(uploader)
    resp = api.post(
        UPLOAD,
        {"category": "document", "filename": "spec.pdf", "size": len(PDF),
         "content_type": "application/pdf", "visibility": "private"},
        format="json",
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    doc_uuid = data["document"]
    put_url = data["upload"]["url"]

    put = api.put(put_url, data=PDF, content_type="application/pdf")
    assert put.status_code == 200

    complete = api.post(f"/api/v1/admin/documents/{doc_uuid}/complete/")
    assert complete.status_code == 200

    doc = Document.objects.get(uuid=doc_uuid)
    assert doc.status == ProcessingStatus.PROCESSED  # eager scan
    assert doc.size_bytes == len(PDF)
    assert len(doc.checksum) == 64


@pytest.mark.django_db
def test_upload_declared_size_over_limit_is_rejected(api, uploader):
    api.force_login(uploader)
    resp = api.post(
        UPLOAD,
        {"category": "image", "filename": "huge.png", "size": 50 * 1024 * 1024},
        format="json",
    )
    assert resp.status_code == 400
    assert "size" in resp.json()["error"]["fields"]


# --- download authorization -------------------------------------


@pytest.mark.django_db
def test_can_download_matrix(db):
    owner = User.objects.create_user(email="o@mds.example", password="x")
    other = User.objects.create_user(email="x@mds.example", password="x")
    viewer = _grant(User.objects.create_user(email="v@mds.example", password="x"), "view_document")

    public = _stored(visibility=Visibility.PUBLIC)
    private = _stored(visibility=Visibility.PRIVATE, owner=owner)

    assert can_download(None, public) is True
    assert can_download(None, private) is False
    assert can_download(other, private) is False
    assert can_download(owner, private) is True
    assert can_download(viewer, private) is True


@pytest.mark.django_db
def test_download_endpoint_logs_and_signs(api, db):
    viewer = _grant(User.objects.create_user(email="v@mds.example", password="x"), "view_document")
    doc = _stored(visibility=Visibility.PRIVATE)

    assert api.get(f"/api/v1/documents/{doc.uuid}/download/").status_code == 403

    api.force_login(viewer)
    resp = api.get(f"/api/v1/documents/{doc.uuid}/download/")
    assert resp.status_code == 200
    assert "/files/d/" in resp.json()["data"]["url"]
    assert DownloadLog.objects.filter(document=doc, user=viewer).count() == 1
    assert AuditLog.objects.filter(action="document.downloaded", entity_id=str(doc.pk)).exists()

    # the signed URL actually serves the bytes
    served = api.get(resp.json()["data"]["url"])
    assert served.status_code == 200
    assert b"".join(served.streaming_content) == PDF


@pytest.mark.django_db
def test_download_before_scan_is_409(api, db):
    doc = _stored(visibility=Visibility.PUBLIC, status=ProcessingStatus.PENDING)
    resp = api.get(f"/api/v1/documents/{doc.uuid}/download/")
    assert resp.status_code == 409


@pytest.mark.django_db
def test_failed_scan_deletes_object(db, monkeypatch):
    import apps.documents.tasks as tasks

    # a detection on the (eager) scan that runs during store_bytes
    monkeypatch.setattr(tasks, "_scan", lambda data, *, content_type: False)
    doc = store_bytes(category="document",
                      uploaded_file=SimpleUploadedFile("r.pdf", PDF, content_type="application/pdf"))
    doc.refresh_from_db()
    assert doc.status == ProcessingStatus.FAILED
    assert not get_storage().exists(doc.object_key)
