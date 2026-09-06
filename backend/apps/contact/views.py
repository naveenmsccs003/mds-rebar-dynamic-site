"""
Enquiry endpoints (docs/API_DESIGN.md, spec §18).

Public — no auth, throttled (`contact`):
    POST /api/v1/contact/

Admin — session auth + `contact.*` permissions:
    GET   /api/v1/admin/enquiries/            ?status= ?enquiry_type= ?assigned_to=
    GET   /api/v1/admin/enquiries/{id}/
    PATCH /api/v1/admin/enquiries/{id}/       status / assigned_to only, lifecycle-gated
    GET/POST /api/v1/admin/enquiries/{id}/notes/   internal thread (append-only)
Status gating (`apps.enquiries.lifecycle`): ASSIGNED / reassignment →
`assign_enquiry`; RESPONDED → `respond_enquiry`; CLOSED → `close_enquiry`.
"""
from __future__ import annotations

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.enquiries import lifecycle
from apps.permissions.permissions import HasRequiredPermissions
from config.api_responses import ok

from . import services
from .models import Enquiry
from .serializers import EnquiryAdminSerializer, EnquiryCreateSerializer, EnquiryNoteSerializer


class EnquiryCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "contact"

    def post(self, request):
        if str(request.data.get("website") or "").strip():
            return ok({"reference": None}, message="Enquiry received.", status=201)

        serializer = EnquiryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.submit_enquiry(request, data=serializer.validated_data)
        return ok(
            {"reference": result.enquiry.public_reference, "status": result.enquiry.status},
            message="Enquiry received." if result.created else "Enquiry already received.",
            status=201,
        )


class EnquiryAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Enquiry.objects.select_related("assigned_to").prefetch_related("notes__author")
    serializer_class = EnquiryAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["status", "enquiry_type", "assigned_to"]
    required_permissions_map = {
        "list": ["contact.view_enquiry"],
        "retrieve": ["contact.view_enquiry"],
        "update": ["contact.change_enquiry"],
        "partial_update": ["contact.change_enquiry"],
        "notes": ["contact.view_enquiry"],
    }

    def perform_update(self, serializer):
        instance = serializer.instance
        before = {"status": instance.status, "assigned_to": instance.assigned_to_id}
        target_status = serializer.validated_data.get("status", instance.status)
        new_assignee = serializer.validated_data.get("assigned_to", instance.assigned_to)
        assignment_changed = getattr(new_assignee, "pk", new_assignee) != instance.assigned_to_id

        lifecycle.check_transition(instance.status, target_status)
        required = lifecycle.required_permission(
            Enquiry, target=target_status, assignment_changed=assignment_changed
        )
        if not self.request.user.has_perm(required):
            raise PermissionDenied(f"'{required}' is required for this change.")

        enquiry = serializer.save()
        after = {"status": enquiry.status, "assigned_to": enquiry.assigned_to_id}
        services.record_admin_change(self.request, enquiry, before, after)

    @action(detail=True, methods=["get", "post"])
    def notes(self, request, pk=None):
        enquiry = self.get_object()
        if request.method == "GET":
            page = self.paginate_queryset(enquiry.notes.select_related("author"))
            return self.get_paginated_response(EnquiryNoteSerializer(page, many=True).data)

        if not request.user.has_perm("contact.change_enquiry"):
            raise PermissionDenied("'contact.change_enquiry' is required to add a note.")
        serializer = EnquiryNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(enquiry=enquiry, author=request.user)
        services.record_admin_change(
            request, enquiry,
            {"note_count": enquiry.notes.count() - 1},
            {"note_count": enquiry.notes.count()},
        )
        return Response(EnquiryNoteSerializer(note).data, status=201)
