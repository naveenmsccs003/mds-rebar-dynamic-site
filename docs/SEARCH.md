# Search

## Phase 1 implementation
PostgreSQL full-text search: `SearchVector`/`SearchRank` with GIN indexes
on the searchable models (services, portfolio, blogs, news, resources).
Ranking combines title/summary weight higher than body content.

## Provider abstraction
A `SearchProvider` interface in the `search` app
(`search(query, filters, page) -> SearchResults`) is the only thing call
sites depend on. The Postgres FTS implementation is one concrete
provider; a future Elasticsearch/OpenSearch provider can be swapped in
via configuration without changing any view or frontend call site.

## Indexing
Search vectors are updated via a Django signal or a Celery task
triggered on save of a searchable, published record — never recomputed
per-request. Reindexing a whole table is a management command / Celery
task, not something that can be accidentally triggered by web traffic.

## Admin search
Always server-side (filtered querysets + pagination) — admin tables never
pull a full dataset into the browser for client-side filtering.

## Public global search
A single `/api/v1/search/?q=...` endpoint fans out across the indexed
content types (or queries a unified search table keyed by content type),
paginated, respecting each result type's publish/visibility rules.
