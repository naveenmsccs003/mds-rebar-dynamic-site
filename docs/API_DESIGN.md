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

## Careers / Applications endpoints (Phase 8 — implemented)

Public — no auth:
```
GET  /api/v1/careers/                active postings, hides past-deadline;
                                     ?department= ?employment_type= ?location= ?q=
GET  /api/v1/careers/{slug}/         full posting; still resolves for a closed posting
                                     (response carries `is_open: false`) so a stale link
                                     shows "applications closed" instead of 404;
                                     `skills_list` is the parsed `skills` CSV
POST /api/v1/career-applications/    multipart; throttle scope `career-applications`
```
`POST /career-applications/` fields: `job` (posting slug), `name`, `email`,
`phone?`, `cover_letter?`, `additional_info?`, `resume` (file), plus a
hidden `website` honeypot. An `Idempotency-Key` header replays the
original result. Résumé rules are enforced **server-side, always**
(docs/FILE_STORAGE.md, docs/SECURITY.md): `RESUME_UPLOAD_MAX_BYTES`
(default 5 MB), extension allow-list `pdf`/`doc`/`docx`, and leading-byte
content sniffing — the browser's filename and `Content-Type` are not
trusted. On success: `201` `{ "reference": "<uuid>", "status": "new" }`
(and `{ "reference": null }` with `200` for a closed posting or a
honeypot hit — no error is surfaced to a bot). Errors: `VALIDATION_ERROR`
(400, field `resume` / `job` / …), `RATE_LIMITED` (429).

Admin — session auth + `applications.*_jobapplication` permissions:
```
GET/POST/PATCH/DELETE /api/v1/admin/careers/               (careers.*_jobposting; CRUD, no workflow)
GET    /api/v1/admin/career-applications/                  (view_jobapplication; ?status= ?job=)
GET    /api/v1/admin/career-applications/{id}/             (view_jobapplication)
PATCH  /api/v1/admin/career-applications/{id}/             (change_jobapplication; status / assigned_to only)
DELETE /api/v1/admin/career-applications/{id}/             (delete_jobapplication)
```
There is no admin `POST` for applications — they are only ever created
through the public endpoint. Every applicant-submitted field and the
résumé are read-only on the admin serializer; it exposes
`resume_filename` / `resume_status` but **no download URL** (the
authorized signed-URL path is Phase 10, and HR tooling must not offer a
download while `resume_status` is `pending`). Submissions write an
`application.submitted` audit row; status / assignment changes write
`application.updated`.

## Quote / Contact endpoints (Phase 9 — implemented)

Public — no auth:
```
POST /api/v1/quote-requests/     throttle scope `quote-requests`; accepts an `Idempotency-Key`
POST /api/v1/contact/            throttle scope `contact`
```
`quote-requests` body: `name`, `email`, `company?`, `phone?`,
`country?` (ISO code), `service?` + `required_services?` (published
service slugs), `project_type?`, `project_location?`, `project_size?`,
`timeline?`, `message?`, hidden `website` honeypot. `contact` body:
`enquiry_type` (`contact` | `business`), `name`, `email`, `phone?`,
`company?`, `message`, hidden `website` honeypot. Free text is
tag-stripped server-side. On success: `201`
`{ "reference": "MDS-Q-YYYY-NNNNNN" | "MDS-E-YYYY-NNNNNN", "status": "new" }`
(`{ "reference": null }` for a honeypot hit — no error to a bot). The
reference is generated inside a transaction from a per-year counter row
locked with `SELECT … FOR UPDATE` (never `count()+1`). A replay with a
matching `Idempotency-Key`, or a same-email submission within 10 minutes,
returns the original record instead of creating a duplicate. Every
submission emails the requester an acknowledgement (with the reference)
and, when `SALES_NOTIFICATION_EMAIL` is set, an internal alert — via
`apps.notifications` (queued `NotificationLog` row + Celery
`send_notification`, retried on failure, never blocking the request).

Admin — session auth + `quotations.*` / `contact.*` permissions:
```
GET/PATCH  /api/v1/admin/quote-requests/            view/change_quoterequest; ?status= ?assigned_to=
GET/PATCH  /api/v1/admin/enquiries/                 view/change_enquiry; ?status= ?enquiry_type= ?assigned_to=
GET/POST   /api/v1/admin/enquiries/{id}/notes/      internal thread; POST needs change_enquiry
```
No admin `POST`/`DELETE` for either — records are created only through
the public endpoints. Everything the submitter sent is read-only; only
`status` and `assigned_to` move, through the shared lead lifecycle
(`apps.enquiries.lifecycle`): NEW → ASSIGNED → IN_PROGRESS → RESPONDED →
CLOSED (+ SPAM), with an illegal move returning `INVALID_TRANSITION`
(400). Permission per transition: reassigning or → ASSIGNED needs
`assign_<model>`; → RESPONDED needs `respond_enquiry` (quotes fall back
to `change_quoterequest`); → CLOSED needs `close_<model>`. Every change
writes a `quote_request.updated` / `enquiry.updated` audit row.

## Documents / Media endpoints (Phase 10 — implemented)

Storage sits behind `apps.documents.storage` (`DOCUMENT_STORAGE_BACKEND`):
`LocalSignedStorage` in dev/test (bytes via `STORAGES["default"]`,
`django.core.signing` tokens, the `/api/v1/files/` transfer views),
`S3SignedStorage` in production (boto3 presigned URLs). Every object key
is random; private is the default; a file is not downloadable until the
scan marks it `processed`.

Admin — session auth + `documents.*` permissions:
```
POST /api/v1/admin/documents/upload/            documents.add_document
     body {category: resume|document|image, filename, size, content_type?, visibility?}
     -> 201 {document: <uuid>, upload: {url, method, headers, expires_in}}
POST /api/v1/admin/documents/{uuid}/complete/   documents.add_document (owner / change_document)
     -> confirms the object landed, records size + checksum, queues the scan
```
The client PUTs the bytes to `upload.url` (a presigned S3 PUT in prod; a
signed `/api/v1/files/u/{token}/` in dev), then calls `complete`.

Download — auth-aware, one shape for every private file:
```
GET /api/v1/documents/{uuid}/download/          -> {url, expires_in}
```
`can_download`: a `public` document is open; a `private` one needs
ownership or `documents.view_document`. On success a `DownloadLog` row
(who / when / IP / UA) and a `document.downloaded` audit row are written
and a short-lived (`DOCUMENT_DOWNLOAD_URL_TTL`, default 300 s) signed URL
is returned — `403` if not allowed, `409` (`NOT_READY`) while the scan is
pending.

Wired into earlier phases:
```
GET /api/v1/resources/{slug}/download/          public open; restricted needs resources.view_resource;
                                                bumps download_count through this path only
GET /api/v1/admin/career-applications/{id}/resume/   HR (view_jobapplication) -> signed résumé URL, logged
GET/POST/PATCH/DELETE /api/v1/admin/media/      media.*_mediaasset — wraps a public Document with alt/caption/dims
```
Content APIs (`services`, `portfolio`, `news`, `resources`) now return a
resolved `image.url` (stable signed URL) in every `MediaRef`, `null`
until the asset is scanned.

## Search endpoint (Phase 11 — implemented)

```
GET /api/v1/search/?q=<text>&type=<t>&type=<t>&page=<n>     public; `search` throttle scope
```
Fans out across `service` / `project` / `news` / `resource` / `job`
(each respecting its own publish rule) via
`apps.search.providers.get_search_provider()` — Postgres FTS
(`SearchRank` over a weighted `SearchVector`) in real environments, an
`icontains` fallback on SQLite. `q` under 2 chars → empty results + a
message. `data`: `{query, results: [{type, title, url, snippet, score}],
count, page, num_pages, page_size}`; `snippet` is tag-stripped.

Also served (outside `/api/v1/`): `GET /sitemap.xml` (published content +
static routes) and `GET /robots.txt` (disallows admin + signed-file
paths, points at the sitemap).

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
