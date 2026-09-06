"""
Storage abstraction (docs/FILE_STORAGE.md "Storage abstraction").

A thin backend interface over Django's ``STORAGES["default"]`` so the
concrete provider (local filesystem in dev/test, S3 / Azure / GCS in
staging+prod) lives entirely behind configuration. Application code only
ever talks to the object returned by :func:`get_storage`.

Two responsibilities beyond plain read/write:

* **signed download URL** — a short-lived, capability-bearing GET link
  for a private object (never a guessable path);
* **signed upload ticket** — what a client needs to send the bytes
  straight to storage (a presigned ``PUT`` for S3; a signed transfer
  URL served by ``apps.documents`` for the local backend).

``LocalSignedStorage`` implements both with ``django.core.signing`` and
the ``/api/v1/files/`` transfer views. ``S3SignedStorage`` is the
production shape (boto3 presigned URLs); its imports are lazy so the
dependency is only needed where it is actually configured.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from django.conf import settings
from django.core import signing
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.urls import reverse

_UPLOAD_SALT = "apps.documents.storage.upload"
_DOWNLOAD_SALT = "apps.documents.storage.download"
# `signing.dumps` -> compact URL-safe base64 (no "/" or ":"), so a token
# drops cleanly into a `<str:token>` path segment.


@dataclass(frozen=True)
class UploadTicket:
    """What the client needs to push bytes to storage."""

    url: str
    method: str
    headers: dict[str, str]
    expires_in: int


class StorageBackend(Protocol):
    def save(self, key: str, content: bytes) -> str: ...
    def open(self, key: str): ...
    def exists(self, key: str) -> bool: ...
    def delete(self, key: str) -> None: ...
    def size(self, key: str) -> int: ...
    def signed_download_url(self, key: str, *, filename: str, expires_in: int | None) -> str: ...
    def signed_upload(self, key: str, *, content_type: str, max_bytes: int, expires_in: int) -> UploadTicket: ...


class LocalSignedStorage:
    """Dev/test backend: bytes go through ``default_storage``; access is
    gated by signed tokens the ``/api/v1/files/`` views verify."""

    def __init__(self):
        self._storage = default_storage

    # --- plain storage -------------------------------------------------
    def save(self, key: str, content: bytes) -> str:
        return self._storage.save(key, ContentFile(content))

    def open(self, key: str):
        return self._storage.open(key, "rb")

    def exists(self, key: str) -> bool:
        return self._storage.exists(key)

    def delete(self, key: str) -> None:
        if self._storage.exists(key):
            self._storage.delete(key)

    def size(self, key: str) -> int:
        return self._storage.size(key)

    # --- signed access ----------------------------------------------
    def signed_download_url(self, key: str, *, filename: str, expires_in: int | None) -> str:
        payload = {"k": key, "f": filename, "ttl": bool(expires_in)}
        token = signing.dumps(payload, salt=_DOWNLOAD_SALT, compress=True)
        return reverse("api_v1:documents:transfer-download", kwargs={"token": token})

    def signed_upload(self, key: str, *, content_type: str, max_bytes: int, expires_in: int) -> UploadTicket:
        token = signing.dumps(
            {"k": key, "ct": content_type, "max": max_bytes}, salt=_UPLOAD_SALT, compress=True
        )
        return UploadTicket(
            url=reverse("api_v1:documents:transfer-upload", kwargs={"token": token}),
            method="PUT",
            headers={"Content-Type": content_type},
            expires_in=expires_in,
        )

    # --- token verification (used by the transfer views) -------------
    @staticmethod
    def verify_download_token(token: str, *, max_age: int | None) -> tuple[str, str]:
        try:
            data = signing.loads(token, salt=_DOWNLOAD_SALT, max_age=max_age)
        except signing.SignatureExpired as exc:
            raise TokenExpired() from exc
        except signing.BadSignature as exc:
            raise TokenInvalid() from exc
        return data["k"], data["f"]

    @staticmethod
    def download_token_is_ttl(token: str) -> bool:
        """True if this download token was minted with an expiry (private
        file) rather than as a stable public-asset link."""
        try:
            data = signing.loads(token, salt=_DOWNLOAD_SALT, max_age=None)
        except signing.BadSignature:
            return True
        return bool(data.get("ttl"))

    @staticmethod
    def verify_upload_token(token: str, *, max_age: int) -> tuple[str, str, int]:
        try:
            data = signing.loads(token, salt=_UPLOAD_SALT, max_age=max_age)
        except signing.SignatureExpired as exc:
            raise TokenExpired() from exc
        except signing.BadSignature as exc:
            raise TokenInvalid() from exc
        return data["k"], data["ct"], int(data["max"])


class TokenInvalid(Exception):
    pass


class TokenExpired(Exception):
    pass


class S3SignedStorage:  # pragma: no cover - exercised only in a real S3 deployment
    """Production backend: bytes live in S3 (via ``django-storages``);
    URLs are boto3 presigned. Imports are deferred so ``boto3`` /
    ``django-storages`` are only required where this backend is selected.
    """

    def __init__(self):
        from storages.backends.s3 import S3Storage

        self._storage = S3Storage()

    def save(self, key: str, content: bytes) -> str:
        return self._storage.save(key, ContentFile(content))

    def open(self, key: str):
        return self._storage.open(key, "rb")

    def exists(self, key: str) -> bool:
        return self._storage.exists(key)

    def delete(self, key: str) -> None:
        self._storage.delete(key)

    def size(self, key: str) -> int:
        return self._storage.size(key)

    def signed_download_url(self, key: str, *, filename: str, expires_in: int | None) -> str:
        params = {"ResponseContentDisposition": f'attachment; filename="{filename}"'}
        return self._storage.bucket.meta.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._storage.bucket_name, "Key": key, **params},
            ExpiresIn=expires_in or 86400,
        )

    def signed_upload(self, key: str, *, content_type: str, max_bytes: int, expires_in: int) -> UploadTicket:
        url = self._storage.bucket.meta.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._storage.bucket_name, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )
        return UploadTicket(url=url, method="PUT", headers={"Content-Type": content_type}, expires_in=expires_in)


@lru_cache(maxsize=1)
def get_storage() -> StorageBackend:
    """The configured storage backend (``settings.DOCUMENT_STORAGE_BACKEND``)."""
    from django.utils.module_loading import import_string

    return import_string(settings.DOCUMENT_STORAGE_BACKEND)()


def reset_storage_cache() -> None:
    """Test helper — drop the cached backend after a settings override."""
    get_storage.cache_clear()
