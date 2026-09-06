"""
CMS API exceptions. Each carries an `envelope_code` so
`config.api_exceptions` renders a specific machine-readable code (see
docs/API_DESIGN.md error envelope) instead of a generic status-derived one.
"""
from rest_framework import exceptions


class InvalidTransition(exceptions.ValidationError):
    """Requested publishing-workflow move is not allowed from the current
    status (e.g. DRAFT -> PUBLISHED without going through review)."""

    envelope_code = "INVALID_TRANSITION"


class VersionMismatch(exceptions.ValidationError):
    """The `ContentVersion` referenced for a rollback does not belong to
    the target object."""

    envelope_code = "VERSION_MISMATCH"
