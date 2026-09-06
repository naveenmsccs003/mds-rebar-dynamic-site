"""
Project-wide pytest fixtures.
"""
import pytest
from django.core.cache import cache
from django.core.files.storage import InMemoryStorage, storages


@pytest.fixture(autouse=True)
def _clear_cache():
    """DRF throttle state lives in the cache; LocMemCache is process-wide
    and would otherwise leak rate-limit counters between tests. Clear it
    around every test so throttling is deterministic."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _reset_in_memory_storage():
    """`STORAGES["default"]` is `InMemoryStorage` under the test settings
    (config/settings/test.py) and keeps files for the whole process —
    re-init it around every test so document uploads don't leak between
    tests."""
    yield
    default = storages["default"]
    if isinstance(default, InMemoryStorage):
        default.__init__()
