"""
Scheduled publishing (docs/TARGET_ARCHITECTURE.md §5 — time-based work
runs on Celery, never in a web request).

`publish_scheduled_content` is registered with Celery beat (every
minute); it flips any APPROVED PageSection whose `scheduled_publish_at`
has passed to PUBLISHED, going through `apps.pages.workflow.transition`
so the snapshot + audit row still happen. `actor` is None (system).
"""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="pages.publish_scheduled_content")
def publish_scheduled_content() -> int:
    from .models import PageSection
    from .workflow import publish_due

    count = publish_due(PageSection)
    if count:
        logger.info("Scheduled publish: %d page section(s) went live", count)
    return count
