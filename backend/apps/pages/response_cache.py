"""
Response cache for the public read endpoints (docs/PERFORMANCE.md
"Caching": "Redis caches published, read-heavy, low-churn content ...
with explicit invalidation on save/delete ... never a cache that can
silently serve stale content past an edit").

Design: a per-namespace **version counter** in the cache. Every cached
entry's key embeds the current version; a write to any underlying model
calls `bump(namespace)`, which increments the counter and so orphans
every previous entry at once — no key enumeration, and no window where a
stale entry can be served after an edit.

Only `AllowAny` `GET` list/retrieve responses are cached, and only the
`200` ones. The body is stored *before* the envelope renderer runs, so
it re-renders normally on a hit.
"""
from __future__ import annotations

from django.core.cache import cache
from rest_framework.response import Response

DEFAULT_TTL = 300  # 5 min ceiling; a write invalidates sooner


def _ver_key(namespace: str) -> str:
    return f"respcache:{namespace}:ver"


def version(namespace: str) -> int:
    v = cache.get(_ver_key(namespace))
    if v is None:
        v = 1
        cache.set(_ver_key(namespace), v, None)
    return v


def bump(namespace: str, **_kwargs) -> None:
    """Invalidate a whole namespace. Signal-friendly (**kwargs)."""
    try:
        cache.incr(_ver_key(namespace))
    except ValueError:  # key missing / non-int backend
        cache.set(_ver_key(namespace), version(namespace) + 1, None)


def bumper(namespace: str):
    """A `post_save` / `post_delete` receiver bound to one namespace."""

    def _receiver(**_kwargs):
        bump(namespace)

    return _receiver


class CachedPublicReadMixin:
    """Mix in *before* `ReadOnlyModelViewSet`. Set `cache_namespace`."""

    cache_namespace: str | None = None
    cache_ttl: int = DEFAULT_TTL

    def list(self, request, *args, **kwargs):
        return self._cached(request, super().list, args, kwargs)

    def retrieve(self, request, *args, **kwargs):
        return self._cached(request, super().retrieve, args, kwargs)

    def _cached(self, request, view_method, args, kwargs):
        ns = self.cache_namespace
        if ns is None or request.method != "GET":
            return view_method(request, *args, **kwargs)

        key = f"respcache:{ns}:{version(ns)}:{request.get_full_path()}"
        cached = cache.get(key)
        if cached is not None:
            return Response(cached["data"], status=cached["status"])

        response = view_method(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(key, {"data": response.data, "status": 200}, self.cache_ttl)
        return response
