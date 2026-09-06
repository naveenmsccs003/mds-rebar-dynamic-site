"""
Logging filters shared across environments.

`RequestIDLogFilter` guarantees every log record has a `request_id`
attribute (falling back to "-") so the structured log format string in
`config/settings/base.py` never raises a `KeyError` for records emitted
outside of a request (management commands, Celery tasks, startup).

Per-request log records get their real request ID attached by
`apps.audit.middleware.RequestIDMiddleware`, which stores it in a
thread/async-local and a small `logging.LoggerAdapter`-free approach:
the middleware sets `record` via `logging.setLogRecordFactory` is
overkill for Phase 1, so instead views/middleware that want the request
ID in their own log lines pull it from the request object directly
(`request.request_id`) and pass it via `extra={"request_id": ...}`.
"""
import logging


class RequestIDLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True
