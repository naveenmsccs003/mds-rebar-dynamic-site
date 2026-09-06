"""
Audit log read API (docs/API_DESIGN.md "Authorization", docs/SECURITY.md
"Audit logging").

    GET /api/v1/admin/audit/         list (cursor-paginated, newest first)
    GET /api/v1/admin/audit/{id}/    retrieve
                                     ?action= ?entity_type= ?actor=

Read-only for holders of `audit.view_auditlog`; `IsAuditReader` refuses
every write method unconditionally — the trail is append-only for
everyone, SuperAdmin included, and there is simply no mutating route.
"""
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, viewsets
from rest_framework.pagination import CursorPagination

from apps.permissions.permissions import IsAuditReader

from .models import AuditLog
from .serializers import AuditLogSerializer


class _AuditCursorPagination(CursorPagination):
    ordering = "-timestamp"
    page_size = 50


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.select_related("actor").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuditReader]
    pagination_class = _AuditCursorPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["action", "entity_type", "actor"]
    search_fields = ["action", "entity_type", "entity_id"]
