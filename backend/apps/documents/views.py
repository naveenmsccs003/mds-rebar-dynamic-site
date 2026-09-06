"""
Document upload / download API (docs/FILE_STORAGE.md).

    POST /api/v1/admin/documents/upload/            declared upload -> ticket   (documents.add_document)
    POST /api/v1/admin/documents/{uuid}/complete/   finalize after the PUT      (documents.add_document)
    GET  /api/v1/documents/{uuid}/download/         authz -> DownloadLog -> URL  (auth-aware)

    PUT  /api/v1/files/u/{token}/                   local backend: receive bytes (token = capability)
    GET  /api/v1/files/d/{token}/                   local backend: serve bytes   (token = capability)

The `/files/` views stand in for object storage in the local backend;
with the S3 backend the client talks to S3 directly and they are unused.
"""
from __future__ import annotations

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.permissions.permissions import HasRequiredPermissions
from config.api_responses import ok

from . import services
from .exceptions import FileNotReady
from .models import Document
from .serializers import DocumentSerializer, UploadRequestSerializer
from .storage import LocalSignedStorage, TokenExpired, TokenInvalid, get_storage


class DocumentUploadView(APIView):
    permission_classes = [HasRequiredPermissions]
    required_permissions = ["documents.add_document"]

    def post(self, request):
        serializer = UploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        document, ticket = services.issue_upload(
            category=data["category"],
            filename=data["filename"],
            size=data["size"],
            content_type=data["content_type"],
            owner=request.user,
            visibility=data["visibility"],
        )
        return ok(
            {"document": str(document.uuid), "upload": ticket},
            message="Upload authorized.",
            status=status.HTTP_201_CREATED,
        )


class DocumentCompleteView(APIView):
    permission_classes = [HasRequiredPermissions]
    required_permissions = ["documents.add_document"]

    def post(self, request, uuid):
        document = get_object_or_404(Document, uuid=uuid)
        if document.owner_id and document.owner_id != request.user.id and not request.user.has_perm(
            "documents.change_document"
        ):
            raise PermissionDenied("Not your upload.")
        services.finalize_upload(document)
        return ok(DocumentSerializer(document).data, message="Upload received; scanning.")


class DocumentDownloadView(APIView):
    """Auth-aware: a public document is downloadable by anyone, a private
    one needs ownership or `documents.view_document`. The signed URL is
    minted only after the check + a `DownloadLog` write."""

    permission_classes = [AllowAny]

    def get(self, request, uuid):
        document = get_object_or_404(Document, uuid=uuid)
        try:
            payload = services.issue_download(document, user=request.user, request=request)
        except services.DownloadForbidden:
            raise PermissionDenied("You cannot access this file.") from None
        except services.DownloadNotReady:
            raise FileNotReady() from None
        return ok(payload)


@method_decorator(csrf_exempt, name="dispatch")
class TransferUploadView(APIView):
    """Local storage backend only — receives the bytes a client PUTs to a
    signed upload URL. The token *is* the authorization."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def put(self, request, token):
        try:
            key, content_type, max_bytes = LocalSignedStorage.verify_upload_token(
                token, max_age=request_ttl_upload()
            )
        except TokenExpired:
            return _plain_error("The upload link has expired.", 410)
        except TokenInvalid:
            raise Http404

        body = request.body
        if len(body) > max_bytes:
            return _plain_error("Uploaded file exceeds the allowed size.", 413)
        if len(body) == 0:
            return _plain_error("Empty upload.", 400)

        get_storage().save(key, body)
        return Response({"success": True, "data": {"received": len(body)}, "message": "", "meta": {}},
                        status=status.HTTP_200_OK)


class TransferDownloadView(APIView):
    """Local storage backend only — streams the bytes behind a signed
    download URL. Authorization already happened when the URL was
    issued; this just checks the signature + expiry."""

    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request, token):
        # Private links carry a TTL; stable public-asset links do not.
        max_age = (
            request_ttl_download()
            if LocalSignedStorage.download_token_is_ttl(token)
            else None
        )
        try:
            key, filename = LocalSignedStorage.verify_download_token(token, max_age=max_age)
        except TokenExpired:
            return _plain_error("The download link has expired.", 410)
        except TokenInvalid:
            raise Http404

        storage = get_storage()
        if not storage.exists(key):
            raise Http404
        return FileResponse(storage.open(key), as_attachment=True, filename=filename)


# --- helpers ------------------------------------------------------


def request_ttl_upload() -> int:
    from django.conf import settings

    return settings.DOCUMENT_UPLOAD_URL_TTL


def request_ttl_download() -> int:
    from django.conf import settings

    return settings.DOCUMENT_DOWNLOAD_URL_TTL


def _plain_error(message: str, code: int) -> Response:
    return Response(
        {"success": False, "error": {"code": "TRANSFER_ERROR", "message": message, "fields": {}}},
        status=code,
    )
