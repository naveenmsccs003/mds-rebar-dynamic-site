"""Phase 10 — MediaAsset admin API: wraps a public Document, exposes a resolved URL."""
import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.documents.models import ProcessingStatus, Visibility
from apps.documents.services import store_bytes

from .models import MediaAsset

User = get_user_model()
ADMIN = "/api/v1/admin/media/"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


def grant(user, *codenames):
    user.user_permissions.add(*Permission.objects.filter(codename__in=codenames))
    return User.objects.get(pk=user.pk)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def editor(db):
    return grant(
        User.objects.create_user(email="ed@mds.example", password="x"),
        *[f"{v}_mediaasset" for v in ("view", "add", "change", "delete")],
    )


def public_image():
    return store_bytes(
        category="image",
        uploaded_file=SimpleUploadedFile("hero.png", PNG, content_type="image/png"),
        visibility=Visibility.PUBLIC,
    )


@pytest.mark.django_db
def test_admin_crud_permissioned(api):
    doc = public_image()
    assert api.post(ADMIN, {"document": doc.id, "alt_text": "Hero"}, format="json").status_code == 401
    plain = User.objects.create_user(email="p@mds.example", password="x")
    api.force_login(plain)
    assert api.post(ADMIN, {"document": doc.id, "alt_text": "Hero"}, format="json").status_code == 403


@pytest.mark.django_db
def test_media_asset_exposes_resolved_url_for_processed_public_doc(api, editor):
    doc = public_image()  # eager scan -> processed
    api.force_login(editor)
    resp = api.post(ADMIN, {"document": doc.id, "alt_text": "Hero image"}, format="json")
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["document_status"] == ProcessingStatus.PROCESSED
    assert body["url"] and "/files/d/" in body["url"]


@pytest.mark.django_db
def test_media_asset_rejects_private_or_double_wrapped_document(api, editor):
    api.force_login(editor)
    private = store_bytes(
        category="image",
        uploaded_file=SimpleUploadedFile("x.png", PNG, content_type="image/png"),
        visibility=Visibility.PRIVATE,
    )
    resp = api.post(ADMIN, {"document": private.id, "alt_text": "x"}, format="json")
    assert resp.status_code == 400
    assert "document" in resp.json()["error"]["fields"]

    pub = public_image()
    MediaAsset.objects.create(document=pub, alt_text="first")
    dup = api.post(ADMIN, {"document": pub.id, "alt_text": "second"}, format="json")
    assert dup.status_code == 400


@pytest.mark.django_db
def test_media_url_is_null_before_scan_completes(api, editor):
    api.force_login(editor)
    doc = public_image()
    doc.status = ProcessingStatus.PENDING
    doc.save(update_fields=["status"])
    resp = api.post(ADMIN, {"document": doc.id, "alt_text": "pending"}, format="json")
    assert resp.status_code == 201
    assert resp.json()["data"]["url"] is None
