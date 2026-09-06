# Search

## Phase 1 implementation
PostgreSQL full-text search: `SearchVector`/`SearchRank` with GIN indexes
on the searchable models (services, portfolio, blogs, news, resources).
Ranking combines title/summary weight higher than body content.

## Implemented (Phase 11)
`apps.search.providers` — `get_search_provider()` returns the backend
named by `SEARCH_PROVIDER` (`auto` → Postgres on PostgreSQL, the
portable fallback elsewhere):

* `PostgresSearchProvider` — a weighted `SearchVector` (title `A` /
  summary `B` / body `C`) ranked with `SearchRank` against a plain
  `SearchQuery`, per searchable type. The vector is computed per query;
  a persisted `SearchVectorField` + GIN index is a performance
  follow-up (Phase 14) that does not change this interface.
* `SimpleSearchProvider` — an `icontains` sweep with a title-hit-beats-
  body-hit score. What the SQLite test suite and any non-Postgres setup
  use; the `/search` contract is identical.

The searchable set (`apps.search.providers.SEARCHABLE`): `service`,
`project`, `news`, `resource`, `job` — each with its publish filter and
its `/…/{slug}` URL. `blogs` / `events` / `csr` join the list when those
models ship (Phase 7-later).

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

**Implemented (Phase 11):** `GET /api/v1/search/?q=&type=&page=`
(`type` repeatable). `q` under 2 chars returns an empty result set with
a message; `search` throttle scope applies. `data`:
`{query, results: [{type, title, url, snippet, score}], count, page,
num_pages, page_size}` — `snippet` is tag-stripped, ~200 chars.
