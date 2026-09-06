"""
Serializer helpers shared by the two enquiry-like admin APIs
(`quotations.QuoteRequest`, `contact.Enquiry`). Like
`apps.pages.serializers.WorkflowStatusMixin` for the publishing workflow,
`LeadStatusMixin` hands the admin UI the lead lifecycle graph so its
status bar renders one action per legal move instead of hardcoding it.
"""
from __future__ import annotations

from rest_framework import serializers

from . import lifecycle


class LeadStatusMixin(serializers.Serializer):
    """Adds a read-only `allowed_transitions` (the legal next states from
    the record's current `status`) to a lead admin serializer. The
    *permission* each move needs is still decided server-side in the
    viewset via `lifecycle.required_permission`."""

    allowed_transitions = serializers.SerializerMethodField()

    def get_allowed_transitions(self, obj) -> list[str]:
        return sorted(lifecycle.allowed_targets(getattr(obj, "status", "") or ""))
