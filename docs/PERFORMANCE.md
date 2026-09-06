# Performance

## Database
`select_related`/`prefetch_related` on every list/detail query;
composite/partial indexes matched to real filter combinations; no
endpoint returns an unbounded queryset — pagination is mandatory on every
list. Query performance is inspected during development (Django Debug
Toolbar in dev, `EXPLAIN ANALYZE` on suspect queries) rather than
optimized blindly.

## Caching
Redis caches published, read-heavy, low-churn content (services,
industries, markets, published blogs/portfolio, site settings) with
explicit invalidation on save/delete of the underlying record — never
user-specific or sensitive data, and never a cache that can silently
serve stale content past an edit.

## Background work
Anything not needed to answer the current request (email, notifications,
image/PDF processing, exports, scheduled publishing, search indexing,
analytics rollups) runs in Celery — never inline in a web request.

## Frontend
Code splitting per route, lazy-loaded non-critical components, responsive
`srcset` images served compressed via the CDN, minimal JS on first paint,
font-display swap, and TanStack Query caching to avoid redundant refetches.

## Core Web Vitals target
LCP, INP, and CLS within "Good" thresholds on the public marketing pages,
verified with Lighthouse/WebPageTest during Phase 14, not assumed.

## Scale posture
Architecture supports pagination + indexing + caching + background jobs
as the first line of defense for large datasets (portfolio, audit,
analytics); read replicas, partitioning, or a dedicated search engine are
documented as later options, not built preemptively before real load
data justifies them.
