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
