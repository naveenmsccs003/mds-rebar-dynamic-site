"""
Job-application endpoints (docs/API_DESIGN.md, spec §16).

Public — no auth, throttled (`career-applications` scope), multipart:
    POST /api/v1/career-applications/     submit an application + résumé

Admin — session auth + `applications.*_jobapplication` permissions:
    GET    /api/v1/admin/career-applications/        ?status= ?job=
    GET    /api/v1/admin/career-applications/{id}/
    PATCH  /api/v1/admin/career-applications/{id}/   status / assigned_to only
    DELETE /api/v1/admin/career-applications/{id}/
There is deliberately no admin `POST` — an application is only ever
created through the public endpoint.
"""
from __future__ import annotations

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents import services as documents
from apps.documents.exceptions import FileNotReady
from apps.permissions.permissions import HasRequiredPermissions
from config.api_responses import ok

from . import services
from .models import JobApplication
from .serializers import JobApplicationAdminSerializer, JobApplicationCreateSerializer


class JobApplicationCreateView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "career-applications"

    def post(self, request):
        # Honeypot: a bot fills every field. Return a normal-looking
        # success and create nothing — never tell it which field gave it
        # away (docs/SECURITY.md "Rate limiting / anti-spam").
        if str(request.data.get("website") or "").strip():
            return ok({"reference": None, "status": None}, message="Application received.", status=201)

        serializer = JobApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if not data["job"].is_open:
            return ok(
                {"reference": None, "status": None},
                message="This posting is no longer accepting applications.",
                status=200,
            )

        result = services.submit_application(
            request,
            data=data,
            resume_file=data["resume"],
            idempotency_key=(request.headers.get("Idempotency-Key") or "")[:255],
        )
        application = result.application
        return ok(
            {"reference": str(application.uuid), "status": application.status},
            message="Application received." if result.created else "Application already received.",
            status=201,
        )


class JobApplicationAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = JobApplication.objects.select_related("job", "assigned_to", "resume")
    serializer_class = JobApplicationAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["status", "job"]
    required_permissions_map = {
        "list": ["applications.view_jobapplication"],
        "retrieve": ["applications.view_jobapplication"],
        "resume": ["applications.view_jobapplication"],
        "update": ["applications.change_jobapplication"],
        "partial_update": ["applications.change_jobapplication"],
        "destroy": ["applications.delete_jobapplication"],
    }

    @action(detail=True, methods=["get"])
    def resume(self, request, pk=None):
        """Short-lived signed URL for the applicant's résumé. HR is
        already authorized by `view_jobapplication`; the download is
        still logged (`DownloadLog` + audit) and refused while the file
        is still being scanned."""
        application = self.get_object()
        if not application.resume_id:
            return Response(
                {"success": False, "error": {"code": "NOT_FOUND",
                                             "message": "No résumé on file.", "fields": {}}},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            payload = documents.issue_download(
                application.resume, user=request.user, request=request, skip_authz=True
            )
        except documents.DownloadNotReady:
            raise FileNotReady("The résumé is still being scanned.") from None
        return ok(payload)

    def perform_update(self, serializer):
        instance = serializer.instance
        before = {"status": instance.status, "assigned_to": instance.assigned_to_id}
        application = serializer.save()
        after = {"status": application.status, "assigned_to": application.assigned_to_id}
        services.record_admin_change(self.request, application, before, after)
