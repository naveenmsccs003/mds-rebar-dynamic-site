"""
Reusable DRF viewset behaviour for CMS-managed models — the publishing
workflow + version-history endpoints and the "snapshot on write" hook,
factored out so every content admin viewset (PageSection now, Service /
News / Blog / Event / CSR / LegalDocument as their phases land) wires
them in the same way instead of re-implementing them.
"""
from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied

from . import workflow
from .exceptions import InvalidTransition
from .serializers import ContentVersionSerializer, TransitionSerializer
from .versioning import rollback as rollback_to_version
from .versioning import snapshot, versions_for


def _model_has_field(model, name: str) -> bool:
    return any(f.name == name for f in model._meta.get_fields())


def crud_perms(app_label: str, model: str) -> dict[str, list[str]]:
    """`required_permissions_map` entries for the standard CRUD actions."""
    return {
        "list": [f"{app_label}.view_{model}"],
        "retrieve": [f"{app_label}.view_{model}"],
        "create": [f"{app_label}.add_{model}"],
        "update": [f"{app_label}.change_{model}"],
        "partial_update": [f"{app_label}.change_{model}"],
        "destroy": [f"{app_label}.delete_{model}"],
    }


def workflow_perms(app_label: str, model: str) -> dict[str, list[str]]:
    """`required_permissions_map` entries for the workflow/version actions.
    The `transition` view body re-checks `publish_<model>` when the target
    is publish-sensitive."""
    return {
        "transition": [f"{app_label}.change_{model}"],
        "versions": [f"{app_label}.view_{model}"],
        "rollback": [f"{app_label}.change_{model}"],
    }


class VersionedViewSetMixin:
    """`perform_create` / `perform_update` that snapshot the object into a
    `ContentVersion` after every write. If the model carries `updated_by`
    it's stamped from the request; if it carries `current_version` the FK
    is repointed at the fresh snapshot."""

    version_note_create = "created"
    version_note_update = "edited"

    def _save_versioned(self, serializer, note: str):
        model = serializer.Meta.model
        extra = {}
        if _model_has_field(model, "updated_by"):
            extra["updated_by"] = self.request.user
        obj = serializer.save(**extra)
        version = snapshot(obj, user=self.request.user, note=note)
        if _model_has_field(model, "current_version"):
            model.objects.filter(pk=obj.pk).update(current_version=version)
            obj.current_version_id = version.pk
        return obj

    def perform_create(self, serializer):
        self._save_versioned(serializer, self.version_note_create)

    def perform_update(self, serializer):
        self._save_versioned(serializer, self.version_note_update)


class WorkflowViewSetMixin:
    """Adds `POST {id}/transition/`, `GET {id}/versions/` and
    `POST {id}/versions/{vid}/rollback/` to a `ModelViewSet` whose model
    has a `status` (`PublishStatus`) field. Permission entries come from
    `workflow_perms()`; the transition body additionally enforces
    `publish_<model>` for publish-sensitive targets."""

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        obj = self.get_object()
        payload = TransitionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        target = payload.validated_data["to"]
        note = payload.validated_data.get("note", "")

        if target not in workflow.allowed_targets(obj.status):
            raise InvalidTransition(
                f"Cannot move from '{obj.status}' to '{target}'. "
                f"Allowed: {sorted(workflow.allowed_targets(obj.status)) or 'none'}."
            )
        required = workflow.required_permission(type(obj), obj.status, target)
        if not request.user.has_perm(required):
            raise PermissionDenied(f"'{required}' is required for this transition.")

        workflow.transition(obj, target, user=request.user, request=request, note=note)
        return self.retrieve(request)

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        obj = self.get_object()
        qs = versions_for(obj).select_related("edited_by")
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(ContentVersionSerializer(page, many=True).data)

    @action(detail=True, methods=["post"], url_path=r"versions/(?P<version_id>[0-9]+)/rollback")
    def rollback(self, request, pk=None, version_id=None):
        obj = self.get_object()
        version = get_object_or_404(versions_for(obj), pk=version_id)
        rollback_to_version(obj, version, user=request.user)
        obj.refresh_from_db()
        return self.retrieve(request)
