# API Design

## Versioning
All endpoints live under `/api/v1/...`. Breaking changes ship as
`/api/v2/...`; `/v1` keeps working until formally deprecated with notice.

## Response envelope

Success:
```json
{ "success": true, "data": { }, "message": "...", "meta": { "pagination": {} } }
```

Error:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "email": ["Enter a valid email."] } } }
```
Implemented as a shared DRF `exception_handler` + a `BaseAPIRenderer`/
response wrapper mixin so every viewset gets this for free. Stack traces
are never returned to the client; unexpected exceptions are logged with a
request ID and a generic `INTERNAL_ERROR` is returned.

## Pagination
`PageNumberPagination` by default (`page`, `page_size`, capped max
`page_size`); cursor pagination for very large/append-heavy lists
(portfolio, audit logs) where deep offset pagination would be slow.

## Filtering / search
`django-filter` `FilterSet` per list endpoint for structured filters
(country, service, industry, year, status); a `?q=` param wired to the
`search` app's `SearchProvider` for free-text queries.

## Auth
- Public endpoints: no auth required, still rate-limited.
- Staff/admin endpoints: session auth (httpOnly, secure, `SameSite=Lax`
  cookies) + Django's CSRF protection for the admin SPA — no bearer
  tokens sitting in `localStorage` where XSS could read them.
- If/when a mobile client needs token auth, `SimpleJWT` with short-lived
  access tokens and rotated + blacklisted refresh tokens, added as an
  additive auth class — session auth stays available for the web admin.

## Authorization
Every protected view declares DRF `permission_classes` mapped to Django
permissions (`services.publish`, `enquiries.assign`, etc.) via a shared
`HasModelPermission`-style class. Object-level checks (e.g., "can this
user view *this* enquiry") are enforced in `get_queryset()`/`has_object_permission()`
— never assumed from the frontend hiding a button.

## Rate limiting
DRF throttling classes: stricter scopes for `login`, `password-reset`,
`quote-requests`, `contact`, `career-applications`, `uploads`, `search`
than for general public GET traffic. Backed by Redis.

## Idempotency
Write endpoints where a duplicate submission is a business problem
(quote requests, job applications) accept an `Idempotency-Key` header;
the server stores the key with the created record's reference and
returns the original result on replay instead of creating a duplicate.

## Documentation
`drf-spectacular` generates the OpenAPI 3 schema at `/api/schema/`; Swagger
UI/Redoc served at `/api/docs/`. Every endpoint documents auth,
permissions required, parameters, response shape, error codes, and
pagination behavior.

## Auth endpoints (Phase 3 — implemented)
Session-cookie auth for the admin SPA, under `/api/v1/auth/`. Full table
and error codes in `docs/RBAC_DESIGN.md` ("Implementation (Phase 3)").
```
GET    /api/v1/auth/csrf/                   (public; sets csrftoken cookie)
GET    /api/v1/auth/session/               (session; 401 when anonymous)
POST   /api/v1/auth/login/                 (public, CSRF-protected, throttled; progressive lockout)
POST   /api/v1/auth/logout/                (session)
POST   /api/v1/auth/password/change/       (session)
POST   /api/v1/auth/password/reset/        (public, throttled; no user enumeration)
POST   /api/v1/auth/password/reset/confirm/ (public; signed token, 24h TTL)
```

## CMS endpoints (Phase 4 — implemented)
Admin surface — session auth + per-action Django permissions
(`HasRequiredPermissions`), under `/api/v1/admin/cms/`:
```
GET/POST        /api/v1/admin/cms/sections/                     (pages.view/add_pagesection; ?page_key=&status=)
GET/PATCH/DELETE /api/v1/admin/cms/sections/{id}/               (pages.view/change/delete_pagesection)
POST            /api/v1/admin/cms/sections/{id}/transition/     body {to, note}; pages.change_pagesection,
                                                                 and pages.publish_pagesection for →published / un-publish / archive-a-live-page
GET             /api/v1/admin/cms/sections/{id}/versions/       (pages.view_pagesection; paginated, newest first)
POST            /api/v1/admin/cms/sections/{id}/versions/{vid}/rollback/   (pages.change_pagesection)
GET/POST/PATCH/DELETE /api/v1/admin/cms/settings/              (pages.*_sitesetting; write invalidates the Redis cache)
GET/POST/PATCH/DELETE /api/v1/admin/cms/tags/                  (pages.*_tag)
GET/POST/PATCH/DELETE /api/v1/admin/cms/redirects/            (pages.*_redirect)
```
`status`, `published_at`, `current_version` are read-only on the section
serializer — status only moves via `transition/`. Rich text inside
`content` is sanitised on write. Error codes: `INVALID_TRANSITION` (400),
`PERMISSION_DENIED` (403), plus the standard envelope set.

Public surface — no auth, read-only, published content only:
```
GET    /api/v1/pages/{page_key}/            published PageSections, ordered by display_order
```

## Service endpoints (Phase 6 — implemented)
Public — no auth, PUBLISHED services only:
```
GET    /api/v1/services/                    paginated; ?technology=<slug>  ?q=<text>
GET    /api/v1/services/{slug}/             full record + capabilities / process_steps / faqs / technology
```
Admin — session auth + `services.*_service` permissions:
```
GET/POST         /api/v1/admin/services/                 (view/add_service; ?status=)
GET/PATCH/DELETE /api/v1/admin/services/{id}/            (view/change/delete_service)
POST  /api/v1/admin/services/{id}/transition/            body {to, note}; change_service,
                                                          publish_service for →published / un-publish / archive
GET   /api/v1/admin/services/{id}/versions/              (view_service; paginated, newest first)
POST  /api/v1/admin/services/{id}/versions/{vid}/rollback/  (change_service)
```
`status` is read-only on the admin serializer (moves via `transition/`);
`long_description` is HTML-sanitised on write. The three child lists
(`capabilities`, `process_steps`, `faqs`) use replace-all semantics — a
list supplied in the body fully replaces that relation; a list omitted is
left untouched. Workflow + versioning are the shared
`apps.pages.api_mixins` behaviour, reused by every content admin viewset
from here on.

## Portfolio / Resources / News endpoints (Phase 7 — implemented)
All list endpoints are paginated + server-filtered — the full table
never reaches the browser.

Public — no auth:
```
GET  /api/v1/portfolio/            PUBLISHED projects; ?country=<code> ?service=<slug> ?industry=<slug> ?year= ?featured= ?q=
GET  /api/v1/portfolio/{slug}/     + description, images, services, technology, public documents
GET  /api/v1/resources/            published resources; ?category= ?access_type= ?q=
GET  /api/v1/resources/{slug}/     restricted resources show metadata only (signed file URL is Phase 10)
GET  /api/v1/news/                 PUBLISHED, newest first; ?category= ?tag=<slug> ?year= ?q=
GET  /api/v1/news/{slug}/          + content (HTML), author name, OG/SEO
```
Admin — session auth + `<app>.*_<model>` permissions
(`portfolio.*_project`, `resources.*_resource`, `news.*_news`):
```
/api/v1/admin/portfolio/          CRUD + transition/ + versions/ + versions/{id}/rollback/   (workflow: publish_project)
/api/v1/admin/resources/          CRUD only — Resource uses a plain `is_published` boolean, no DRAFT/REVIEW workflow
/api/v1/admin/news/               CRUD + transition/ + versions/ + versions/{id}/rollback/   (workflow: publish_news)
```
`status` is read-only on the workflow serializers; `description` /
`content` are HTML-sanitised on write; Project's `images` list is
replace-all; News `author` is set from the request user on create and
`tags` are assigned by id. Portfolio/News reuse `apps.pages.api_mixins`.

## Example endpoints (illustrative, finalized per app in Phase 6–10)
```
GET    /api/v1/services/                    (public, paginated, filterable)
GET    /api/v1/services/{slug}/             (public)
POST   /api/v1/quote-requests/              (public, throttled, idempotent)
GET    /api/v1/admin/quote-requests/        (staff, permission: quotations.view)
PATCH  /api/v1/admin/quote-requests/{id}/   (staff, permission: quotations.edit)
GET    /api/v1/portfolio/?country=UAE&service=rebar-detailing&page=2
GET    /api/v1/search/?q=rebar+detailing
```
