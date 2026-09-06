"""
Project-wide pytest fixtures.
"""
import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _clear_cache():
    """DRF throttle state lives in the cache; LocMemCache is process-wide
    and would otherwise leak rate-limit counters between tests. Clear it
    around every test so throttling is deterministic."""
    cache.clear()
    yield
    cache.clear()
