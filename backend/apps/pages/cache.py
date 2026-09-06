"""
`SiteSetting` is read on nearly every request (default contact info,
feature flags — spec §31/§42/§88) and changes rarely, so the whole table
is cached as one dict and invalidated on write.
"""
from __future__ import annotations

from django.core.cache import cache

SITE_SETTINGS_CACHE_KEY = "pages:site_settings:v1"
_TIMEOUT = 60 * 60  # 1h; writes invalidate immediately anyway


def get_site_settings() -> dict[str, str]:
    cached = cache.get(SITE_SETTINGS_CACHE_KEY)
    if cached is not None:
        return cached

    from .models import SiteSetting

    data = dict(SiteSetting.objects.values_list("key", "value"))
    cache.set(SITE_SETTINGS_CACHE_KEY, data, _TIMEOUT)
    return data


def invalidate_site_settings(**_kwargs) -> None:
    cache.delete(SITE_SETTINGS_CACHE_KEY)
