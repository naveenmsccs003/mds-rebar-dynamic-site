"""
Public global search (docs/API_DESIGN.md, docs/SEARCH.md).

    GET /api/v1/search/?q=<text>&type=<t>&type=<t>&page=<n>

One endpoint fanning out across the indexed public content types
(service / project / news / resource / job), paginated, respecting each
type's publish rules. Backed by `apps.search.providers.get_search_provider`
(Postgres FTS in real environments, an `icontains` fallback elsewhere).
"""
from __future__ import annotations

from dataclasses import asdict

from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from config.api_responses import ok

from .providers import MIN_QUERY_LEN, get_search_provider

_PAGE_SIZE = 20
_TYPES = {"service", "project", "news", "resource", "job"}


class SearchView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "search"

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        types = [t for t in request.query_params.getlist("type") if t in _TYPES] or None

        if len(query) < MIN_QUERY_LEN:
            return ok(
                {"query": query, "results": [], "count": 0, "page": 1, "num_pages": 0},
                message=f"Enter at least {MIN_QUERY_LEN} characters.",
            )

        hits = get_search_provider().search(query, types=types)

        try:
            page = max(1, int(request.query_params.get("page", "1")))
        except ValueError:
            page = 1
        start = (page - 1) * _PAGE_SIZE
        window = hits[start : start + _PAGE_SIZE]

        return ok(
            {
                "query": query,
                "results": [asdict(h) for h in window],
                "count": len(hits),
                "page": page,
                "num_pages": (len(hits) + _PAGE_SIZE - 1) // _PAGE_SIZE,
                "page_size": _PAGE_SIZE,
            }
        )
