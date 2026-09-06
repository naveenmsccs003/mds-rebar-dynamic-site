# Target Architecture

## 1. System Overview

```
                                   USERS
                                     |
                              CDN / WAF (edge)
                                     |
                              Load Balancer / Reverse Proxy (HTTPS/HSTS)
                                     |
                +--------------------+--------------------+
                |                                         |
         FRONTEND (static)                         BACKEND API
   React + TypeScript + Vite                    Django + DRF (gunicorn)
   served via CDN/static hosting                behind reverse proxy
                |                                         |
                +--------------------+--------------------+
                                     |
                +--------------------+--------------------+
                |                    |                    |
           PostgreSQL              Redis          Object Storage
        (system of record)   (cache/broker)     (S3-compatible, via
                                     |            storage abstraction)
                                Celery Workers
                              + Celery Beat (scheduler)
```

Future:
```
MDS Website/CMS  --->  Integration API/Service  --->  MDS Trackmate
```
The CMS never talks to Trackmate's database directly (see
`TRACKMATE_INTEGRATION.md`).

## 2. Frontend

- **Build:** Vite + React 18 + TypeScript, strict mode on.
- **Routing:** React Router (data router), one reusable template per content
  type (e.g., one `ServiceDetailPage` renders all 12+ services from data).
- **Server state:** TanStack Query for all API reads/writes — no manual
  fetch + `useEffect` state juggling.
- **Forms:** React Hook Form + Zod schemas shared between form validation
  and TypeScript types (`schemas/`).
- **Structure:** feature-based (`src/features/<domain>`), with shared
  primitives in `src/components` (Button, Input, Select, Modal, Table,
  Pagination, Filters, Card, Breadcrumbs, Alert, LoadingState, EmptyState,
  ErrorState, ConfirmDialog).
- **Build output:** static assets deployed behind the CDN; the app talks
  only to the versioned `/api/v1/...` backend — no secrets, no direct DB
  access, ever.

## 3. Backend

- **Framework:** Django + Django REST Framework, `gunicorn` behind
  `nginx`/reverse proxy in production.
- **App boundaries** follow `backend/<domain>/` per §52 of the spec
  (accounts, users, roles, permissions, pages, services, industries,
  markets, portfolio, resources, news, blogs, events, careers,
  applications, enquiries, quotations, contact, testimonials, clients,
  technology, csr, legal, documents, media, notifications, audit,
  analytics, search).
- **Layering inside each app:** `models.py`, `serializers.py`,
  `views.py`/`viewsets.py`, `permissions.py`, `services.py` (business
  logic, kept out of views so it's testable and reusable), `tasks.py`
  (Celery), `admin.py`.
- **Settings:** split into `settings/base.py`, `dev.py`, `staging.py`,
  `production.py`, `test.py` — all secrets via environment variables
  (`django-environ`), never hardcoded.

## 4. Database

- PostgreSQL as the single system of record. No large binary blobs in the
  DB — object storage holds files, PostgreSQL holds metadata.
- UUID public identifiers on any model that must not leak a sequential
  internal ID (quotes, enquiries, applications, documents). Internal FK
  relationships still use efficient integer PKs; the UUID/reference number
  is a separate publicly-exposed field with a unique index.
- All schema changes via Django migrations, reviewed before merge.

## 5. Caching & Background Work

- **Redis:** cache backend for published/public read-heavy content
  (services, industries, markets, published blogs/news/portfolio,
  settings) and as the Celery broker/result backend. Cache keys are
  invalidated on the relevant model's `save()`/`delete()` (via signals or
  explicit service-layer calls) — never time-only invalidation for content
  that editors expect to update immediately.
- **Celery + Celery Beat:** email/notifications, image/PDF processing,
  scheduled publishing, resume processing, exports, search indexing,
  analytics aggregation. No long-running work happens inside a web request.

## 6. Object Storage

- Abstraction layer (`backend/documents/storage.py` or a small
  `StorageBackend` interface) wrapping Django's `Storage` API so the
  concrete provider (S3 / Azure Blob / GCS / any S3-compatible service)
  is swappable via configuration only. Public assets (published images)
  go through the CDN; private files (resumes, restricted resources) are
  never public — access is via short-lived signed URLs issued after a
  server-side authorization check.

## 7. Search

- Phase 1 implementation: PostgreSQL full-text search
  (`SearchVector`/`SearchRank` + GIN indexes) across services, portfolio,
  blogs, news, and resources.
- Abstracted behind a `search/` app service interface
  (`SearchProvider.search(query, filters) -> results`) so a future swap to
  Elasticsearch/OpenSearch touches only the provider implementation, not
  call sites.

## 8. API

- Versioned under `/api/v1/...`. A new backward-incompatible change is
  shipped as `/api/v2/...`, not a breaking change to `/v1`.
- DRF viewsets + routers, `django-filter` for query filtering, DRF's
  `PageNumberPagination` (or cursor pagination for very large/portfolio
  data) everywhere lists are returned.
- Consistent envelope (see `API_DESIGN.md`) for success/error responses.
- `drf-spectacular` (OpenAPI 3) for `/api/schema/` and `/api/docs/`.
- Authentication: session auth (httpOnly, secure, SameSite cookies) for the
  admin SPA and public forms where practical, or DRF SimpleJWT with short
  access tokens + rotated/blacklisted refresh tokens if a token-based
  approach is required for future mobile clients. Decision recorded in
  `RBAC_DESIGN.md` / `SECURITY.md`.

## 9. Infrastructure / Environments

- Docker Compose for local dev: `frontend`, `backend`, `postgres`,
  `redis`, `worker` (Celery), `scheduler` (Celery Beat).
- Four environments: development, testing, staging, production — each with
  its own settings module, database, and `.env` (never shared, never the
  production DB used for dev/test).
- CI/CD: lint → type-check → unit tests → security checks → build →
  integration tests → Docker build → staging deploy → smoke tests →
  manual production approval → production deploy.

## 10. Multi-country & i18n readiness

- `markets` app models Country → Region → Office/Operations → Contact as
  data, not hardcoded frontend content. All timestamps stored in UTC,
  converted to local time only for display.
- Content models designed so a future translation layer (e.g., per-locale
  content rows or a translation table) can be added without breaking the
  existing schema — not implemented in Phase 1, but not blocked either.

## 11. Extension points (future, not built now)

- **AI:** enquiry classification, content assistance, AI search — planned
  as separate service hooks behind the existing `search`/`enquiries`
  service layers, not built into the core request path.
- **Mobile:** consumes the same `/api/v1/` — no React-specific coupling in
  API responses (no HTML fragments, no assumptions about a browser DOM).
- **Microservices:** app boundaries in §52 are chosen so `search`,
  `notifications`, `documents`, `analytics`, and the Trackmate
  `integration` layer could each be extracted into a standalone service
  later without a full rewrite.
