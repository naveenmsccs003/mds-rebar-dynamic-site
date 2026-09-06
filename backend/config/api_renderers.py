"""
Default JSON renderer that wraps any plain response body in the success
envelope from docs/API_DESIGN.md, so every future viewset gets it for
free without repeating boilerplate.

Bodies that are already an envelope (they carry a top-level ``success``
key — e.g. anything from `config.api_responses.ok` or the exception
handler) pass through untouched.
"""
from __future__ import annotations

from rest_framework.renderers import JSONRenderer


class EnvelopeJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        if isinstance(data, dict) and "success" in data:
            payload = data
        else:
            payload = {"success": True, "data": data, "message": "", "meta": {}}
        return super().render(payload, accepted_media_type, renderer_context)
