# Performance

## Database
`select_related`/`prefetch_related` on every list/detail query;
composite/partial indexes matched to real filter combinations; no
endpoint returns an unbounded queryset — pagination is mandatory on every
list. Query performance is inspected during development (Django Debug
Toolbar in dev, `EXPLAIN ANALYZE` on suspect queries) rather than
optimized blindly.

**Audit (Phase 14).** `backend/tests/test_query_performance.py` seeds
several rows per endpoint and asserts a flat query count
(`django_assert_max_num_queries`) — a regression that reintroduces an
N+1 fails CI. The audit found and fixed one: Phase 10's `image.url`
addition to `MediaRefSerializer` resolves `MediaAsset.document`, which
was not in any content list's `select_related` — every public list that
serialises media (`services`, `news`, `portfolio`, `resources`) now
pulls `..._image__document` / `images__image__document`.

## Caching
Redis caches published, read-heavy, low-churn content (services,
industries, markets, published blogs/portfolio, site settings) with
explicit invalidation on save/delete of the underlying record — never
user-specific or sensitive data, and never a cache that can silently
serve stale content past an edit.

**Implemented (Phase 14).** `apps.pages.response_cache.CachedPublicReadMixin`
caches the `200` `AllowAny` `GET` list/retrieve responses of the public
content viewsets (`services`, `news`, `portfolio`, `resources`,
`pages/{key}`) under a key that embeds a **per-namespace version
counter**. `bump(namespace)` — wired from `post_save`/`post_delete` on
each namespace's models in `apps.pages.apps.ready()` — increments the
counter, orphaning every prior entry at once, so an edit is never served
stale (test: `tests/test_response_cache.py`). `SiteSetting` keeps its
Phase 4 whole-table cache. 5-minute TTL ceiling; LocMemCache in tests,
Redis everywhere else.

## Background work
Anything not needed to answer the current request (email, notifications,
image/PDF processing, exports, scheduled publishing, search indexing,
analytics rollups) runs in Celery — never inline in a web request.

## Frontend
Code splitting per route, lazy-loaded non-critical components, responsive
`srcset` images served compressed via the CDN, minimal JS on first paint,
font-display swap, and TanStack Query caching to avoid redundant refetches.

**Implemented (Phase 14).** `src/app/router.tsx` lazy-loads every route
except the homepage (`React.lazy` + a `<Suspense>` `RouteFallback`);
Vite emits one chunk per route. Initial JS dropped from ~142 kB gzip to
~84 kB — the rest arrives per route (0.3–6 kB each) or as a shared
vendor chunk on first need. `web-vitals` reports LCP/INP/CLS/FCP/TTFB
via `src/app/reportWebVitals.ts` (logs in dev; the deploy pipeline
points the sink at RUM). The font stack is system-only, so `font-display`
is moot; `srcset` waits on the CDN (Phase 15).

## Core Web Vitals target
LCP, INP, and CLS within "Good" thresholds on the public marketing pages,
verified with Lighthouse/WebPageTest during Phase 14, not assumed.

**Load testing (Phase 14).** `backend/locustfile.py` — a `PublicVisitor`
weighted across the hot read endpoints plus one throttled write. Not in
CI (needs a running target + data); run against staging before a
release. `locust` is in `requirements/dev.txt`.

## Scale posture
Architecture supports pagination + indexing + caching + background jobs
as the first line of defense for large datasets (portfolio, audit,
analytics); read replicas, partitioning, or a dedicated search engine are
documented as later options, not built preemptively before real load
data justifies them.
