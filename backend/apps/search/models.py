"""
No models here. Phase 11 (SEO + Search) adds `SearchVectorField` columns
+ GIN indexes directly on the searchable models (services, portfolio,
blogs, news, resources) and a `SearchProvider` service class
(docs/SEARCH.md) — this app owns that provider abstraction, not a table
of its own.
"""
