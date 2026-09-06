"""
Quote-request endpoints (docs/API_DESIGN.md, spec §17).

Public — no auth, throttled (`quote-requests`), idempotent:
    POST /api/v1/quote-requests/

Admin — session auth + `quotations.*` permissions:
    GET    /api/v1/admin/quote-requests/          ?status= ?assigned_to=
    GET    /api/v1/admin/quote-requests/{id}/
    PATCH  /api/v1/admin/quote-requests/{id}/     status / assigned_to only
The status move is permission-gated per `apps.enquiries.lifecycle`:
reassigning or moving to ASSIGNED needs `assign_quoterequest`; CLOSED
needs `close_quoterequest`; anything else needs `change_quoterequest`.
"""
from __future__ import annotations

from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.enquiries import lifecycle
from apps.permissions.permissions import HasRequiredPermissions
from config.api_responses import ok

from . import services
from .models import QuoteRequest
from .serializers import QuoteRequestAdminSerializer, QuoteRequestCreateSerializer


class QuoteRequestCreateView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "quote-requests"

    def post(self, request):
        if str(request.data.get("website") or "").strip():
            return ok({"reference": None}, message="Quote request received.", status=201)

        serializer = QuoteRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.submit_quote_request(
            request,
            data=serializer.validated_data,
            idempotency_key=(request.headers.get("Idempotency-Key") or "")[:255],
        )
        return ok(
            {"reference": result.quote.public_reference, "status": result.quote.status},
            message="Quote request received." if result.created else "Quote request already received.",
            status=201,
        )


class QuoteRequestAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = QuoteRequest.objects.select_related("country", "service", "assigned_to").prefetch_related(
        "required_services"
    )
    serializer_class = QuoteRequestAdminSerializer
    permission_classes = [HasRequiredPermissions]
    filterset_fields = ["status", "assigned_to"]
    required_permissions_map = {
        "list": ["quotations.view_quoterequest"],
        "retrieve": ["quotations.view_quoterequest"],
        "update": ["quotations.change_quoterequest"],
        "partial_update": ["quotations.change_quoterequest"],
    }

    def perform_update(self, serializer):
        instance = serializer.instance
        before = {"status": instance.status, "assigned_to": instance.assigned_to_id}
        target_status = serializer.validated_data.get("status", instance.status)
        new_assignee = serializer.validated_data.get("assigned_to", instance.assigned_to)
        assignment_changed = getattr(new_assignee, "pk", new_assignee) != instance.assigned_to_id

        lifecycle.check_transition(instance.status, target_status)
        required = lifecycle.required_permission(
            QuoteRequest, target=target_status, assignment_changed=assignment_changed
        )
        if not self.request.user.has_perm(required):
            raise PermissionDenied(f"'{required}' is required for this change.")

        quote = serializer.save()
        after = {"status": quote.status, "assigned_to": quote.assigned_to_id}
        services.record_admin_change(self.request, quote, before, after)
