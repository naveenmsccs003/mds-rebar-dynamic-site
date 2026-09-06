"""
Search provider abstraction (docs/SEARCH.md "Provider abstraction").

Call sites depend only on `get_search_provider().search(...)`. Two
concrete providers ship:

* `PostgresSearchProvider` — PostgreSQL full-text search
  (`SearchQuery` / `SearchRank` over a weighted `SearchVector`), used in
  every real environment.
* `SimpleSearchProvider` — a portable `icontains` fallback (title matches
  outrank body matches). It is what the SQLite test suite and any
  non-Postgres setup use, and it keeps the public `/search` contract
  identical.

A future Elasticsearch/OpenSearch provider slots in the same way — set
`SEARCH_PROVIDER` and change nothing else.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable

from django.conf import settings
from django.db import connection
from django.db.models import Q, QuerySet
from django.utils.html import strip_tags

from apps.careers.models import JobPosting
from apps.news.models import News
from apps.pages.models import PublishStatus
from apps.portfolio.models import Project
from apps.resources.models import Resource
from apps.services.models import Service

MIN_QUERY_LEN = 2
MAX_RESULTS = 100
_SNIPPET_LEN = 200


@dataclass(frozen=True)
class Searchable:
    type: str
    model: type
    title_field: str
    summary_fields: tuple[str, ...]  # weight B (Postgres)
    body_fields: tuple[str, ...]     # weight C
    url_template: str
    published: Callable[[QuerySet], QuerySet]


SEARCHABLE: list[Searchable] = [
    Searchable(
        "service", Service, "name", ("short_description",), ("long_description",),
        "/services/{slug}", lambda qs: qs.filter(status=PublishStatus.PUBLISHED),
    ),
    Searchable(
        "project", Project, "title", (), ("description",),
        "/portfolio/{slug}", lambda qs: qs.filter(status=PublishStatus.PUBLISHED),
    ),
    Searchable(
        "news", News, "title", ("summary",), ("content",),
        "/news/{slug}", lambda qs: qs.filter(status=PublishStatus.PUBLISHED),
    ),
    Searchable(
        "resource", Resource, "title", ("description",), (),
        "/resources#{slug}", lambda qs: qs.filter(is_published=True),
    ),
    Searchable(
        "job", JobPosting, "title", ("skills",), ("description", "requirements"),
        "/careers/{slug}", lambda qs: qs.filter(is_active=True),
    ),
]

_BY_TYPE = {s.type: s for s in SEARCHABLE}


@dataclass
class SearchHit:
    type: str
    title: str
    url: str
    snippet: str
    score: float


def _snippet(*values: str) -> str:
    text = " ".join(strip_tags(v) for v in values if v).strip()
    return (text[:_SNIPPET_LEN].rsplit(" ", 1)[0] + "…") if len(text) > _SNIPPET_LEN else text


def _configs(types: list[str] | None) -> list[Searchable]:
    if not types:
        return SEARCHABLE
    return [_BY_TYPE[t] for t in types if t in _BY_TYPE]


class SearchProvider(ABC):
    @abstractmethod
    def search(self, query: str, *, types: list[str] | None = None) -> list[SearchHit]: ...


class SimpleSearchProvider(SearchProvider):
    """Portable `icontains` search. Not ranked by relevance beyond
    "a hit in the title beats a hit in the body"."""

    def search(self, query: str, *, types=None) -> list[SearchHit]:
        query = (query or "").strip()
        if len(query) < MIN_QUERY_LEN:
            return []

        hits: list[SearchHit] = []
        for cfg in _configs(types):
            fields = (cfg.title_field, *cfg.summary_fields, *cfg.body_fields)
            predicate = Q()
            for f in fields:
                predicate |= Q(**{f"{f}__icontains": query})
            qs = cfg.published(cfg.model.objects.all()).filter(predicate)[:MAX_RESULTS]
            for obj in qs:
                title = getattr(obj, cfg.title_field, "") or ""
                in_title = query.lower() in title.lower()
                hits.append(
                    SearchHit(
                        type=cfg.type,
                        title=title,
                        url=cfg.url_template.format(slug=obj.slug),
                        snippet=_snippet(*(getattr(obj, f, "") for f in (*cfg.summary_fields, *cfg.body_fields))),
                        score=2.0 if in_title else 1.0,
                    )
                )
        hits.sort(key=lambda h: (-h.score, h.title.lower()))
        return hits[:MAX_RESULTS]


class PostgresSearchProvider(SearchProvider):
    """PostgreSQL FTS: a weighted `SearchVector` (title A / summary B /
    body C) ranked against a plain-language `SearchQuery`. The vector is
    computed per query — a persisted `SearchVectorField` + GIN index is a
    performance follow-up (docs/PERFORMANCE.md / Phase 14) and does not
    change this interface."""

    def search(self, query: str, *, types=None) -> list[SearchHit]:
        query = (query or "").strip()
        if len(query) < MIN_QUERY_LEN:
            return []

        from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector

        sq = SearchQuery(query, search_type="plain")
        hits: list[SearchHit] = []
        for cfg in _configs(types):
            vector = SearchVector(cfg.title_field, weight="A")
            for f in cfg.summary_fields:
                vector = vector + SearchVector(f, weight="B")
            for f in cfg.body_fields:
                vector = vector + SearchVector(f, weight="C")

            qs = (
                cfg.published(cfg.model.objects.all())
                .annotate(rank=SearchRank(vector, sq))
                .filter(rank__gt=0)
                .order_by("-rank")[:MAX_RESULTS]
            )
            for obj in qs:
                hits.append(
                    SearchHit(
                        type=cfg.type,
                        title=getattr(obj, cfg.title_field, "") or "",
                        url=cfg.url_template.format(slug=obj.slug),
                        snippet=_snippet(*(getattr(obj, f, "") for f in (*cfg.summary_fields, *cfg.body_fields))),
                        score=round(float(obj.rank), 4),
                    )
                )
        hits.sort(key=lambda h: -h.score)
        return hits[:MAX_RESULTS]


def get_search_provider() -> SearchProvider:
    name = getattr(settings, "SEARCH_PROVIDER", "auto")
    if name == "auto":
        name = "postgres" if connection.vendor == "postgresql" else "simple"
    providers = {"simple": SimpleSearchProvider, "postgres": PostgresSearchProvider}
    try:
        return providers[name]()
    except KeyError:
        raise ValueError(f"Unknown SEARCH_PROVIDER {name!r}; expected one of {sorted(providers)} or 'auto'.")
