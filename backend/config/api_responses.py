"""
Helper for building the success side of the response envelope in
docs/API_DESIGN.md:

    { "success": true, "data": {...}, "message": "...", "meta": {...} }

The error side is produced by `config.api_exceptions`; the envelope is
also applied automatically to any view that returns raw data by
`config.api_renderers.EnvelopeJSONRenderer`. Use `ok()` when you want to
attach a human-readable `message` or `meta`.
"""
from __future__ import annotations

from rest_framework.response import Response


def ok(data=None, *, message: str = "", meta: dict | None = None, status: int = 200) -> Response:
    return Response(
        {"success": True, "data": data, "message": message, "meta": meta or {}},
        status=status,
    )
