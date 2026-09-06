"""DRF API exceptions for the document download paths."""
from rest_framework.exceptions import APIException


class FileNotReady(APIException):
    """The file exists but has not cleared processing / scanning
    (docs/FILE_STORAGE.md) — retry once the scan completes."""

    status_code = 409
    default_code = "NOT_READY"
    default_detail = "This file is still being processed."
