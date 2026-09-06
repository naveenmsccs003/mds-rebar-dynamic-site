"""
Shared DRF exception handler enforcing the response envelope defined in
docs/API_DESIGN.md:

    { "success": false, "error": { "code": ..., "message": ..., "fields": {} } }

Unexpected (non-DRF) exceptions are logged with the request ID and turned
into a generic INTERNAL_ERROR — the client never sees a stack trace.
"""
import logging

from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

_CODE_BY_STATUS = {
    400: "VALIDATION_ERROR",
    401: "AUTHENTICATION_REQUIRED",
    403: "PERMISSION_DENIED",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    429: "RATE_LIMITED",
}


def envelope_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)

    if response is None:
        # Anything DRF didn't already turn into an HTTP response is an
        # unexpected server error: log it, never expose it.
        request = context.get("request")
        request_id = getattr(request, "request_id", "-")
        logger.exception(
            "Unhandled exception", extra={"request_id": request_id}
        )
        return Response(
            {
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred.",
                    "fields": {},
                },
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = _CODE_BY_STATUS.get(response.status_code, "ERROR")
    fields = {}
    message = "Request failed."

    if isinstance(response.data, dict):
        fields = {k: v for k, v in response.data.items() if k != "detail"}
        message = str(response.data.get("detail", message))
    elif isinstance(response.data, list):
        message = "; ".join(str(item) for item in response.data)

    response.data = {
        "success": False,
        "error": {"code": code, "message": message, "fields": fields},
    }
    return response
