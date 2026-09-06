# Changelog

## [Unreleased] — 2026-09-06
### Added
- Repository initialized (was empty, no prior commits).
- Architecture & planning documentation set under `/docs`:
  `CURRENT_STATE.md`, `TARGET_ARCHITECTURE.md`, `DATABASE_DESIGN.md`,
  `API_DESIGN.md`, `RBAC_DESIGN.md`, `UI_DESIGN_SYSTEM.md`,
  `SECURITY.md`, `FILE_STORAGE.md`, `SEARCH.md`, `SEO.md`,
  `PERFORMANCE.md`, `TESTING.md`, `DEPLOYMENT.md`, `CI_CD.md`,
  `BACKUP_DISASTER_RECOVERY.md`, `TRACKMATE_INTEGRATION.md`,
  `DEVELOPMENT_PHASES.md`.
- Phase 1 (Architecture + Project Setup): Django backend project with
  app skeletons for every domain in the target architecture; React +
  TypeScript + Vite frontend scaffold with feature-based folder
  structure; Docker Compose for local development; environment variable
  templates; base CI workflow; `.gitignore`; root `README.md`.
- Phase 2 (Database Foundation): custom `users.User` model (email login,
  brute-force-protection fields) wired as `AUTH_USER_MODEL`; the ten
  RBAC roles from `docs/RBAC_DESIGN.md` seeded as Django Groups via a
  data migration; real models + migrations + Django admin registration
  for every domain app (pages/CMS with generic version history and a
  shared `PublishableContent` base for News/Blog/Event/CSR, services,
  industries, markets, portfolio, resources, careers, applications,
  quotations, contact/enquiries, testimonials, clients, technology,
  csr, legal, documents/media, notifications, audit); atomic, race-safe
  public reference number generation for quotes (`MDS-Q-...`) and
  enquiries (`MDS-E-...`); 41 backend tests (model constraints,
  custom user manager, admin changelist/add-page smoke tests across
  every registered model, and the reference-generator concurrency test)
  — verified against both SQLite and a real PostgreSQL 16 instance.
  `docs/DATABASE_DESIGN.md` updated with the handful of deliberate
  deviations made during implementation.
- Phase 3 (Authentication + RBAC): session-cookie auth API for the admin
  SPA under `/api/v1/auth/` (`csrf`, `session`, `login`, `logout`,
  `password/change`, `password/reset`, `password/reset/confirm`) — no
  bearer tokens; login is CSRF-protected and throttled. Per-account
  progressive brute-force lockout (`AUTH_LOCKOUT_*` settings) on top of
  the per-IP `login` throttle, with a full audit trail of auth events.
  Argon2 password hashing (PBKDF2 fallback); hardened session/CSRF
  cookies (httpOnly, `SameSite=Lax`, sliding 12 h expiry,
  `*_SECURE` in staging/prod); password reset via Django's signed-token
  generator (24 h TTL) with console email in dev / SMTP in staging+prod.
  Reusable DRF permission classes in `apps.permissions`
  (`HasModelPermission`, `HasRequiredPermissions`, `IsActiveUser`,
  `IsAuditReader`, `ReadOnly`) and a `permissions_payload` helper. The
  ten RBAC roles get their Django permissions from a declarative map
  applied by the idempotent `manage.py sync_roles` command
  (`apps.roles.role_permissions`). Response envelope from
  `docs/API_DESIGN.md` now applied automatically via
  `EnvelopeJSONRenderer` + typed error codes. 43 new backend tests
  (auth flow, lockout, CSRF, password reset, permission classes, role
  seeding). `docs/RBAC_DESIGN.md` updated with the implemented surface.
- Fixed: `backend/.gitignore` had a bare `media/` rule that also matched
  `backend/apps/media/`, so the entire `apps.media` app (`MediaAsset` +
  migration `0001`) was never committed in Phase 1/2 despite being in
  `INSTALLED_APPS` with ~15 FKs pointing at `media.MediaAsset` — a fresh
  clone could not boot Django. Rules anchored (`/media/`,
  `/staticfiles/`) and the app added to version control.
- Phase 4 (CMS): a generic, reusable publishing workflow + version
  history for CMS content, wired to `pages.PageSection`.
  - `apps.pages.workflow.transition()` moves any model with a `status`
    field through DRAFT → REVIEW → APPROVED → PUBLISHED → ARCHIVED,
    enforcing `change_<model>` for the review states and
    `publish_<model>` for anything that changes what the public sees;
    each transition snapshots the object and writes an `AuditLog` row.
    Illegal moves return `INVALID_TRANSITION` (400). A Celery-beat task
    (`pages.publish_scheduled_content`, every minute) publishes APPROVED
    sections whose `scheduled_publish_at` has passed.
  - `apps.pages.versioning` — `snapshot()` writes a full field state into
    `ContentVersion` (generic FK); `rollback()` restores a past snapshot
    and is itself versioned. `PageSection` gained `published_at`,
    `scheduled_publish_at`, `current_version`, and the
    `pages.publish_pagesection` permission (migrations `0002`, `0003`).
  - `apps.pages.sanitize.sanitize_html` — `bleach` allow-list stripping
    `<script>`/`<style>`/`<iframe>`, `on*` handlers, `javascript:` URLs
    and inline `style`; `SanitizedHTMLField` serializer field for later
    content models; `PageSection.content` JSON is sanitised at `*_html`
    keys.
  - CMS API under `/api/v1/admin/cms/` (session auth + per-action
    permissions): `sections/` CRUD + `transition/` + `versions/` +
    `versions/{id}/rollback/`; `settings/` (writes invalidate the Redis
    cache via signal); `tags/`; `redirects/`. Public read-only
    `GET /api/v1/pages/{page_key}/` returns published sections in order.
  - `pages.Redirect` (old_path → new_path 301/302) +
    `create_redirect()` helper (collapses redirect chains) for
    slug-change handling; admin bulk publish/review/archive actions route
    through the workflow.
  - 43 new backend tests (sanitiser, versioning + rollback, workflow +
    permission split + scheduled publish, redirects, CMS API CRUD +
    transitions + rollback + cache invalidation + public read). Full
    suite: 126 passed, 1 skipped. Verified on SQLite (no PostgreSQL
    client in the build env); no PG-specific SQL introduced.
  - `docs/API_DESIGN.md` and `docs/DATABASE_DESIGN.md` updated.
- Phase 5 (Public Website): the public homepage, About page and the four
  legal pages, rendered from the Phase 4 CMS API — no page content
  hardcoded in React.
  - `features/cms/`: `usePage(pageKey)` (TanStack Query) → `getPage` →
    `GET /api/v1/pages/{page_key}/`; `SectionRenderer` maps
    `PageSection.section_key` to a section component (`hero`, `prose`,
    `cta`, `card_grid`, `stat_list`, with a safe `FallbackSection`) in
    the API's `display_order`, so editors reorder/hide/edit sections from
    the CMS without a frontend deploy (docs/UI_DESIGN_SYSTEM.md homepage
    section order). `CmsPage` wires SEO + the four data states around it.
  - Pages: `HomePage` (`home`), `AboutPage` (`about`), `LegalPage`
    (one component for `legal-privacy-policy` / `-terms` / `-nda` /
    `-data-security`), `NotFoundPage`. Routes wired in `app/router.tsx`;
    the rest stay `PlaceholderPage` until their phase.
  - Design system: `Container`, `Section` (default/muted/dark bands),
    `Card`, `Breadcrumbs`, `Skeleton`, `PageState` (Loading/Success/
    Empty/Error+Retry in one wrapper), `SEOHead` (React 19 native
    `<title>`/`<meta>`/`<link>` hoisting — no react-helmet), `RichText`
    (client-side DOMPurify re-sanitisation of the already
    server-sanitised CMS HTML, per docs/SECURITY.md "again before
    render"). Design tokens (colour, 4/8px spacing, 12→64px type scale,
    container widths) in `src/index.css`.
  - `PublicLayout`: skip link, labelled `Primary` nav + a keyboard
    -operable mobile menu toggle (`aria-expanded`/`aria-controls`),
    focus moved to `<main>` on route change, footer nav columns. Nav
    items are a static typed list (`layouts/navItems.ts`) — a
    CMS-managed navigation model is a later enhancement.
  - `api/request.ts`: shared envelope-unwrapping wrapper
    (`apiGet`/`apiPost`/… → `T` or a typed `ApiRequestError`) that every
    later feature's API module builds on.
  - `dompurify` added as a dependency.
  - 22 new frontend tests (SEOHead, RichText, PageState, SectionRenderer,
    HomePage data states, PublicLayout a11y). `npm run lint` / `test` /
    `build` all green — 25 tests pass.
  - Rendering decision recorded in `docs/SEO.md`: client-rendered SPA
    now, build-time prerendering of the marketing routes planned for the
    deploy pipeline (Phase 15). `docs/UI_DESIGN_SYSTEM.md` updated with
    the implemented components.
- Phase 6 (Services): one reusable data model + one reusable API + one
  reusable frontend template render every service (spec §10).
  - Reusable viewset behaviour factored into `apps.pages.api_mixins`:
    `WorkflowViewSetMixin` (`transition` / `versions` /
    `versions/{id}/rollback` actions, generic over `type(obj)`) and
    `VersionedViewSetMixin` (snapshot on every write; stamps `updated_by`
    / repoints `current_version` when the model has them). `PageSection`'s
    viewset was refactored onto them.
  - Service API: public `GET /api/v1/services/` (paginated,
    `?technology=<slug>`, `?q=`) and `GET /api/v1/services/{slug}/` —
    PUBLISHED only, with nested capabilities / process steps / FAQs /
    technology. Admin `/api/v1/admin/services/` CRUD + `transition/` +
    `versions/` + rollback, gated by `services.*_service` /
    `services.publish_service`. `long_description` HTML-sanitised on
    write; `status` read-only (moves via `transition`); the three child
    lists use replace-all semantics (supplied → replaces, omitted →
    untouched). 14 backend tests.
  - Frontend `features/services/`: `useServices()` / `useService(slug)`
    hooks; `ServiceListPage` (card grid); `ServiceDetailTemplate` —
    breadcrumb → hero → overview (RichText) → capabilities → process →
    business value → technology → standards → deliverables → output
    formats → FAQs → quote CTA, all sections conditional on data. A 404
    from the detail endpoint renders the NotFound page. Routes
    `/services` + `/services/:slug` wired in. 8 frontend tests.
  - `api/request.ts` `apiGet` param type loosened to `object`.
  - Backend suite: 137 passed, 1 skipped. Frontend: `lint` / `test`
    (33 pass) / `build` green. `docs/API_DESIGN.md` updated.
- Phase 7 (Portfolio + Resources + News): three public catalogues +
  admin CRUD, all list endpoints paginated + server-filtered.
  - Portfolio: public `GET /api/v1/portfolio/` (`?country` `?service`
    `?industry` `?year` `?featured` `?q`) + `/{slug}/`; admin
    `/api/v1/admin/portfolio/` CRUD + workflow (reuses
    `apps.pages.api_mixins`; `publish_project`). `description`
    HTML-sanitised; `images` replace-all.
  - Resources: public `GET /api/v1/resources/` (`?category`
    `?access_type` `?q`) + `/{slug}/`; admin CRUD. Deliberately a plain
    `is_published` boolean — resources are a file catalogue, not
    editorial prose, so no DRAFT/REVIEW workflow or version history.
    Restricted resources expose metadata only (signed file URL is
    Phase 10).
  - News: public `GET /api/v1/news/` (newest first; `?category` `?tag`
    `?year` `?q`) + `/{slug}/`; admin CRUD + workflow (`publish_news`).
    `content` HTML-sanitised; `author` set from the request user on
    create; `tags` assigned by id. News extends `PublishableContent`, so
    Blogs / Events / CSR get the same serializer shape later.
  - Shared reusable serializers `MediaRefSerializer` /
    `NamedSlugRefSerializer` promoted to `apps.pages.serializers`
    (services updated to use them).
  - Frontend: `PortfolioListTemplate` (FilterBar + Pagination, filters +
    page in the URL via `useListParams`) + `PortfolioDetailTemplate`;
    `ResourceListTemplate`; shared `ArticleListTemplate` /
    `ArticleDetailTemplate` (reusable for Blogs / Events / CSR) wired up
    by `NewsListPage` / `NewsArticlePage`. New shared components
    `Pagination`, `FilterBar`. Routes `/portfolio`, `/portfolio/:slug`,
    `/resources`, `/news`, `/news/:slug` wired in.
  - 19 backend + 20 frontend tests. Backend: 154 passed, 1 skipped.
    Frontend `lint` / `test` / `build` green. Also fixed a latent
    unused import in a Phase 6 test file (masked by tsc's incremental
    cache; a fresh checkout / CI build would have failed on it).
  - `docs/API_DESIGN.md` + `docs/UI_DESIGN_SYSTEM.md` updated.
- Phase 8 (Careers + Applications): public job board + a secured
  application form with résumé upload.
  - Careers API: public `GET /api/v1/careers/` (`?department`
    `?employment_type` `?location` `?q`; active and not-past-deadline
    only) + `GET /api/v1/careers/{slug}/` (still resolves for a closed
    posting so a stale link explains itself rather than 404s; exposes a
    computed `is_open` and a parsed `skills_list`). Admin
    `/api/v1/admin/careers/` CRUD gated by `careers.*_jobposting` — a
    plain `is_active` flag, no publishing workflow. `JobPosting.is_open`
    property added (active + deadline check).
  - Application submission: public `POST /api/v1/career-applications/`
    (multipart, `AllowAny`, `career-applications` throttle scope).
    Résumé validation is entirely server-side (`apps.applications.
    uploads`): size ceiling (`RESUME_UPLOAD_MAX_BYTES`, default 5 MB),
    extension allow-list (`pdf` / `doc` / `docx`), and leading-byte
    content sniffing so a non-PDF renamed `.pdf` (or an HTML/script
    payload) is refused. The stored object key is a random UUID under a
    private prefix — never the uploaded filename; a `documents.Document`
    row records `original_filename` / `content_type` / `size` / SHA-256
    checksum, `visibility=private`, `status=pending` for the Phase 10
    malware-scan hook (`uploads.scan_hook`). Free-text fields are
    tag-stripped before storage.
  - Anti-spam / integrity (`apps.applications.services`): a hidden
    `website` honeypot (silent fake-success, nothing created); an
    `Idempotency-Key` header replays the original application (partial
    unique constraint on `JobApplication.idempotency_key`, migration
    `0002`); a same job + email submission within 10 minutes is treated
    as a duplicate. Every submission writes an `application.submitted`
    `AuditLog` row; a queued `NotificationLog` row is written when
    `CAREERS_NOTIFICATION_EMAIL` is set (the sender itself is Phase 9).
  - Admin workflow: `/api/v1/admin/career-applications/` (list /
    retrieve / patch / delete, no create) gated by
    `applications.*_jobapplication`; only `status` and `assigned_to` are
    writable — every applicant-supplied field and the résumé are
    read-only, and no download URL is exposed (that is the Phase 10
    signed-URL path). Status / assignment changes write an
    `application.updated` audit row.
  - `STORAGES["default"]` left as `FileSystemStorage` with an explicit
    git-ignored `MEDIA_ROOT`; test settings use `InMemoryStorage` so the
    suite never touches disk. `apiPostForm` helper added to
    `frontend/src/api/request.ts`.
  - Frontend `features/careers/`: `CareersListPage` (FilterBar +
    Pagination via `useListParams`), `JobDetailTemplate` (one template
    per posting, inline `ApplicationForm`, disabled + explained when
    closed), `ApplicationForm` (client-side name/email/résumé
    type + size checks as a courtesy, hidden honeypot, server field
    errors mapped back onto inputs, success state with the reference
    UUID, fresh `Idempotency-Key` per attempt). Routes `/careers` +
    `/careers/:slug` wired in; form styles added to `src/index.css`
    (reused by contact/quote in Phase 9).
  - 26 backend + 10 frontend tests. Backend: 180 passed, 1 skipped.
    Frontend `lint` / `test` (59 pass) / `build` green.
  - `docs/API_DESIGN.md`, `docs/DATABASE_DESIGN.md`, `docs/SECURITY.md`,
    `docs/FILE_STORAGE.md` updated.
- Phase 9 (Quote + Contact + Enquiries): public quote / contact forms
  with generated reference numbers, an admin workflow, and real
  notifications.
  - Notification sender (`apps.notifications`): `services.queue()` writes
    a `NotificationLog` row up front then dispatches the Celery task
    `notifications.send_notification`, which renders
    `templates/notifications/email/<template>.txt`, sends, and records
    `sent` / `failed` + `attempts` / `last_error`, retrying with backoff
    (max 5). Delivery never runs in the web request and a failure never
    propagates to the caller. Phase 8's job-application alert was moved
    onto this path.
  - Quote requests: public `POST /api/v1/quote-requests/` (throttle
    `quote-requests`, `Idempotency-Key` honoured, hidden honeypot,
    10-minute same-email dedupe). `public_reference`
    (`MDS-Q-YYYY-NNNNNN`) is generated from the Phase 2 locked per-year
    counter. `service` / `required_services` are published-service slugs;
    free text is tag-stripped (`PlainTextField`, promoted to
    `apps.pages.serializers`). Emails the requester an acknowledgement
    with the reference + an internal alert to `SALES_NOTIFICATION_EMAIL`.
    Admin `/api/v1/admin/quote-requests/` (list / retrieve / patch — no
    create or delete) gated by `quotations.*`.
  - Enquiries: public `POST /api/v1/contact/` (throttle `contact`,
    honeypot, dedupe), `MDS-E-YYYY-NNNNNN` reference, same
    acknowledgement + internal alert. Admin
    `/api/v1/admin/enquiries/` + an append-only
    `/{id}/notes/` internal thread (`EnquiryNote`).
  - Shared lead lifecycle in `apps.enquiries.lifecycle` (the empty
    `apps.enquiries` app now houses what quotes and enquiries share): a
    permissive NEW→ASSIGNED→IN_PROGRESS→RESPONDED→CLOSED (+SPAM)
    transition graph with `INVALID_TRANSITION` on an illegal move, and a
    per-transition permission rule — reassign / →ASSIGNED needs
    `assign_<model>`, →RESPONDED needs `respond_enquiry` (quotes fall
    back to `change`), →CLOSED needs `close_<model>`. Every admin change
    writes a `*.updated` audit row; every submission a `*.submitted` one.
  - Frontend: `features/contact/ContactPage` and
    `features/quote/RequestQuotePage` (routes `/contact`,
    `/request-quote` wired off `PlaceholderPage`); shared
    `features/shared/publicForm.ts` (`fieldErrorsFromApi` /
    `formErrorFromApi`), which `ApplicationForm` was refactored onto.
    The quote form's service list is the published catalogue via the
    Phase 6 `useServices` hook; country selection waits for a markets
    API (later phase — the field is optional server-side).
  - 19 backend + 7 frontend tests. Backend: 199 passed, 1 skipped;
    `manage.py check` clean. Frontend `lint` / `test` (66 pass) /
    `build` green.
  - `docs/API_DESIGN.md` + `docs/DATABASE_DESIGN.md` updated.
- Phase 10 (Documents + Media): the storage abstraction, presigned-style
  upload, private signed download, and download logging that phases 5–9
  deferred here.
  - `apps.documents.storage` — `get_storage()` returns the backend named
    by `DOCUMENT_STORAGE_BACKEND`. `LocalSignedStorage` (dev/test) stores
    through `STORAGES["default"]` and mints `django.core.signing` tokens
    verified by the `/api/v1/files/{u,d}/{token}/` transfer views;
    `S3SignedStorage` (production) uses `django-storages` + boto3
    presigned URLs, imported lazily. `private/…` vs `public/…` key
    prefixes; visibility + signing gate access.
  - `apps.documents.validation` — per-category policies (`resume` /
    `document` / `image`): size ceiling, extension allow-list,
    leading-byte signature sniff. The résumé policy still reads the
    `RESUME_UPLOAD_*` settings. `apps.applications.uploads` is now a thin
    adapter over this (keeps the `resume` error-field name).
  - `apps.documents.services` — `store_bytes` (direct server-side store),
    `issue_upload` / `finalize_upload` (declared upload → ticket → the
    client PUTs → confirm + checksum + queue scan), `issue_download`
    (authz → `DownloadLog` + `document.downloaded` audit → short-lived
    signed URL; `409 NOT_READY` while `pending`), `public_url` (stable
    signed URL for a public processed asset). `documents.scan_document`
    (Celery) is the malware-scan hook — a detection deletes the object
    and marks the row `failed`; nothing downloads while `pending`.
  - Endpoints: `POST /api/v1/admin/documents/upload/` +
    `{uuid}/complete/` (`documents.add_document`);
    `GET /api/v1/documents/{uuid}/download/` (auth-aware). Media admin
    API `GET/POST/PATCH/DELETE /api/v1/admin/media/` (`media.*_mediaasset`)
    — a `MediaAsset` wraps a public `Document` and exposes its resolved
    `url`. `MediaRefSerializer` gained `url` across every content API
    (`null` until scanned).
  - Wired into earlier phases: `GET /api/v1/resources/{slug}/download/`
    (public open; `restricted` needs `resources.view_resource`;
    `download_count` only ever moves through this authorized path);
    `GET /api/v1/admin/career-applications/{id}/resume/` (HR signed
    résumé URL, logged, `409` before the scan clears).
  - Frontend: `MediaImage` component (real `<img>` when the asset has a
    `url`, labelled placeholder otherwise) used in the portfolio
    gallery; `MediaRef` type gained `url`. Resources list gained a
    Download action per file-bearing resource — resolves the signed URL
    at click time and navigates to it, explains a `403` on a restricted
    resource.
  - `conftest.py` resets `InMemoryStorage` around every test. Test
    settings already route `STORAGES["default"]` to it, so no upload
    touches disk.
  - 20 backend + 7 frontend tests (storage round-trip, token expiry,
    validation, upload→PUT→complete→scan, download authz matrix +
    `DownloadLog` + serving bytes, failed-scan cleanup, media URL
    resolution, resource + résumé download). Backend: 219 passed, 1
    skipped; `manage.py check` clean. Frontend `lint` / `test`
    (73 pass) / `build` green.
  - `docs/API_DESIGN.md`, `docs/FILE_STORAGE.md`, `docs/SECURITY.md`
    updated.
- Phase 11 (SEO + Search): the global search API + provider abstraction,
  plus sitemap / robots / structured data.
  - `apps.search.providers` — `get_search_provider()` returns the backend
    named by `SEARCH_PROVIDER` (`auto` → `PostgresSearchProvider` on
    PostgreSQL, else `SimpleSearchProvider`). Postgres provider ranks a
    weighted `SearchVector` (title A / summary B / body C) with
    `SearchRank` against a plain `SearchQuery`, per searchable type
    (vector computed per query — a persisted `SearchVectorField` + GIN
    index is a Phase 14 follow-up and does not touch the interface).
    Simple provider is a portable `icontains` sweep with a
    title-hit-beats-body-hit score — what the SQLite test suite uses.
    `SEARCHABLE` registry: `service` / `project` / `news` / `resource` /
    `job`, each with its publish filter and `/…/{slug}` URL.
  - `GET /api/v1/search/?q=&type=&page=` (`type` repeatable; `search`
    throttle scope) — `q` under 2 chars returns empty + a message.
    `data`: `{query, results: [{type, title, url, snippet, score}],
    count, page, num_pages, page_size}`; `snippet` is tag-stripped.
  - `/sitemap.xml` — `django.contrib.sitemaps` (`apps.pages.sitemaps`,
    per-type `Sitemap` classes over published items + the static public
    routes; `RequestSite` so URLs use the request host, `protocol=https`).
    `/robots.txt` — `config.seo.robots_txt` disallows `/admin/`,
    `/api/v1/admin/`, `/api/v1/files/`, `/api/v1/documents/`,
    `/api/schema/`, `/api/docs/` and points at the sitemap.
    `django.contrib.sitemaps` added to `INSTALLED_APPS` (no migrations).
  - Frontend: `features/search/SearchPage` (query + type filter in the
    URL, paginated, `noindex`) wired at `/search` (+ a nav link);
    `components/JsonLd` — `<JsonLd>` emits one `application/ld+json`
    block (angle brackets escaped), builders in `JsonLd/schemas.ts`:
    `organizationLd` on the homepage, `articleLd` on every
    `ArticleDetailTemplate` (news), `jobPostingLd` on every job page.
  - 10 backend + 10 frontend tests (provider selection, cross-type
    search + publish exclusion, ranking, type filter, pagination,
    throttle, snippet sanitisation, robots + sitemap contents; SearchPage
    states + URL sync, JsonLd output + escaping). Backend: 229 passed, 1
    skipped; `manage.py check` clean. Frontend `lint` / `test` (83 pass)
    / `build` green.
  - `docs/SEARCH.md`, `docs/SEO.md`, `docs/API_DESIGN.md` updated.
- Phase 12 (Security Hardening): a review pass — headers/CSP, rate-limit
  baseline, upload-validation + audit-log review. No new features, no
  schema change.
  - `config.security.SecurityHeadersMiddleware` — a strict
    `Content-Security-Policy` (`default-src 'self'`; no inline/remote
    script; `style-src 'unsafe-inline'` only for the Django admin;
    `frame-ancestors 'none'`; `object-src 'none'`) and a
    `Permissions-Policy` disabling unused browser features. Report-only
    in staging (`CSP_REPORT_ONLY`, on by default there), enforced in
    production; `/api/schema/` + `/api/docs/` exempt. `django-csp` was
    evaluated and skipped — the middleware is exactly as much policy as
    the Django-served surface needs.
  - Baseline throttling: `AnonRateThrottle` (`THROTTLE_ANON`, default
    120/min per IP) + `UserRateThrottle` (`THROTTLE_USER`, default
    600/min) added to `DEFAULT_THROTTLE_CLASSES` alongside the existing
    per-scope throttles — all API traffic including GETs now has a
    ceiling (docs/SECURITY.md "general public API traffic").
  - staging + production: `SECURE_PROXY_SSL_HEADER`
    (`X-Forwarded-Proto`) so `request.is_secure()` / the SSL redirect /
    `robots.txt` scheme are right behind a TLS-terminating proxy.
    Production also drops DRF's `BrowsableAPIRenderer` (JSON only).
  - Upload-validation audit: `UploadValidationError` now logs every
    rejection to a dedicated `security` logger (a run of rejected
    uploads is a probing signal); allow-lists reviewed. Audit-log
    coverage reviewed and written up in `docs/SECURITY.md` (Django-admin
    user/role edits land in Django's native `LogEntry`; the admin SPA's
    user API will write `AuditLog` directly when it ships).
  - `manage.py check --deploy` is clean of `security.W*` findings with a
    real secret key.
  - 7 backend tests (CSP + Permissions-Policy present / exempt paths /
    report-only toggle / on JSON responses; anon baseline throttle trips,
    authenticated users get the higher ceiling). Backend: 236 passed, 1
    skipped; `manage.py check` clean. No frontend change (the SPA host
    serves its own CSP).
  - `docs/SECURITY.md` + `docs/CHANGELOG.md` updated.
- Phase 13 (Testing): filled the suites out to `docs/TESTING.md` and
  wired the CI security gates.
  - Backend `tests/test_integration.py` — four end-to-end journeys
    (publishing workflow draft→review→approved→published with audit +
    version + visibility assertions at each hop; quote submission → both
    notifications → assign → close; document upload → PUT → complete →
    scan → authorized download + DownloadLog; career application →
    résumé stored/scanned → HR download). +4 tests → 240 backend, 1
    skipped.
  - Static analysis / security in CI: `ruff` (narrow rule set —
    pyflakes, flake8-bandit, flake8-django, mutable-default args, stray
    print, unused noqa; config in `backend/pyproject.toml`), `bandit -r
    apps config`, and `pip-audit` (advisory) added to the backend job.
    Existing code cleaned to pass (stale `# noqa`, unused imports, a
    bare `except/pass` now logged). **Django bumped 5.1 → 5.2.x** to
    clear seven `pip-audit` CVEs; full suite re-run green on 5.2.17.
  - Frontend MSW layer (`src/test/msw/`, `onUnhandledRequest: "bypass"`
    so the existing `vi.mock("./api")` suites are untouched):
    `src/api/request.test.ts` covers the real envelope-unwrap + error
    mapping over HTTP; `features/services/hooks.test.tsx` drives the
    TanStack Query hooks against it. `msw` devDep. +8 → 91 frontend
    tests.
  - Playwright E2E (`frontend/e2e/`, `playwright.config.ts`,
    `npm run e2e`): public journeys with the API stubbed per test via
    `page.route` (`e2e/support.ts`) — home nav, global search, contact
    form (validation → success), careers list→detail→application-form
    validation. Runs against `vite preview`, no backend needed. New
    `e2e` CI job; `@playwright/test` devDep. Admin-side journeys
    (login/RBAC/publishing/user+permission management/audit) pending the
    admin SPA.
  - CI header comment updated; `vite.config.ts` scopes vitest to `src/`
    so it ignores `e2e/`; `frontend/.gitignore` gets the Playwright
    output dirs.
  - `docs/TESTING.md` + `docs/CHANGELOG.md` updated.
- Phase 14 (Performance): query audit, response caching, code splitting,
  load-test scaffold.
  - `tests/test_query_performance.py` — 8 query-count guards
    (`django_assert_max_num_queries`) over the hot public endpoints;
    they caught one N+1: Phase 10's `image.url` resolves
    `MediaAsset.document`, absent from every content list's
    `select_related`. Fixed — `services` / `news` / `portfolio` /
    `resources` public querysets now pull `..._image__document` /
    `images__image__document`.
  - `apps.pages.response_cache.CachedPublicReadMixin` — caches the 200
    AllowAny GET list/retrieve responses of `services` / `news` /
    `portfolio` / `resources` / `pages/{key}` under a key embedding a
    per-namespace version counter. `bump(namespace)` (wired from
    post_save/post_delete in `apps.pages.apps.ready()`) invalidates the
    whole namespace at once — no stale content past an edit. 5-min TTL
    ceiling. `tests/test_response_cache.py` (4 tests: hit, invalidation,
    admin-edit reflected, per-filter keys).
  - Frontend route code splitting: `src/app/router.tsx` lazy-loads every
    route but the homepage (`React.lazy` + `<Suspense>` `RouteFallback`).
    Initial JS ~142 kB gzip → ~84 kB; the rest per route (0.3–6 kB) or a
    shared vendor chunk. `web-vitals` (`src/app/reportWebVitals.ts`)
    reports LCP/INP/CLS/FCP/TTFB — logs in dev, RUM sink is Phase 15.
  - `backend/locustfile.py` — `PublicVisitor` weighted across the hot
    read endpoints + one throttled write. `locust` in
    `requirements/dev.txt` (also `-r test.txt` so dev gets the lint
    tools). Not in CI.
  - +12 backend tests → 252 passed, 1 skipped; `ruff` / `bandit` clean.
    Frontend 91 tests + 4 E2E green; `lint` / `build` green.
  - `docs/PERFORMANCE.md` + `docs/CHANGELOG.md` updated.
- Phase 15 (Docker + CI/CD): production images + the full pipeline.
  - `backend/Dockerfile` and `frontend/Dockerfile` are now multi-stage:
    `--target dev` (compose; autoreload + dev deps) and `--target prod`
    (slim, non-root `app` user, `collectstatic` baked in,
    `gunicorn -c gunicorn.conf.py`; frontend `prod` = nginx serving
    `dist/` with an SPA fallback + cache headers). `.dockerignore` in
    each; `docker-compose.yml` targets `dev` and de-dupes via YAML
    anchors. `boto3` added to `requirements/production.txt`.
  - `config.settings.production` wires object storage (django-storages
    S3; `AWS_STORAGE_BUCKET_NAME` flips `DOCUMENT_STORAGE_BACKEND` to
    `S3SignedStorage`), Sentry (`SENTRY_DSN`), and keeps the Phase 12
    hardening. `config.settings.ci` runs the suite against real
    Postgres/Redis.
  - `.github/workflows/ci.yml` is the full pipeline (docs/CI_CD.md):
    `backend` (ruff + bandit + pip-audit + check + pytest), `frontend`
    (lint + vitest + build + npm audit), `integration` (pytest under
    `config.settings.ci` against Postgres 16 + Redis 7 service
    containers — the PG-only concurrency test now runs), `e2e`
    (Playwright), `docker` (build `--target prod`, push to
    `ghcr.io/<repo>/{backend,frontend}:<sha>` on `main`),
    `deploy-staging` (auto on `main`, GitHub `staging` environment, runs
    `smoke.spec.ts` against `STAGING_URL`), `deploy-production`
    (`needs: deploy-staging`, `production` environment = the manual
    approval gate). Deploy steps are `echo` placeholders to wire to the
    platform.
  - `frontend/e2e/smoke.spec.ts` (home loads, `/health/` + `/ready/` OK,
    public API answers) — selected only when `SMOKE_BASE_URL` is set;
    `playwright.config.ts` skips the local server in that mode.
  - `README.md` updated with the CI/CD flow and the repo-side config
    still to do (branch protection, environments, deploy commands).
  - `router.tsx`'s lazy-route helper moved to `src/app/lazyRoute.tsx`
    (clean lint). No backend logic change; 252 backend / 91 frontend /
    4 E2E still green.
  - `docs/CI_CD.md`, `docs/DEPLOYMENT.md`, `docs/CHANGELOG.md` updated.
- Phase 16 (Production Readiness): readiness gating, backup drill,
  acceptance suite, as-built docs — the last phase.
  - `/ready/` now gates on **database + cache + migrations applied** (a
    rolling deploy that skipped `migrate` returns 503 so the LB drops
    the instance); the Celery broker is reported but informational.
    `/health/` stays dependency-free. `tests/test_health.py` expanded to
    5 tests (gating, pending-migration block).
  - `backend/scripts/restore_drill.sh` — `pg_dump` → fresh scratch DB →
    `pg_restore` → `migrate --check` + a row-count assertion, drop.
    Runs in CI as the `backup-drill` job (Postgres service container,
    `needs: [integration]`, blocks `docker`); in production, schedule it
    against the latest real backup.
  - `backend/tests/test_acceptance.py` (9 tests) — one place that
    re-asserts the cross-cutting guarantees: response envelope
    (success + error), server-side authz (401/403), append-only audit,
    security headers, public-write throttle, health/ready/robots/sitemap
    served, global search answers, private files not anonymously
    downloadable. `docs/ACCEPTANCE.md` maps these + a manual pre-launch
    checklist (incl. the spec §81 walk-through).
  - `docs/CURRENT_STATE.md` rewritten from the Phase-1 greenfield report
    to the as-built state (what each phase delivered; what is deferred —
    the admin SPA, real deploy infra, business content, CDN images,
    prerendering, malware scanner, blogs/events/csr APIs).
  - `docs/BACKUP_DISASTER_RECOVERY.md` finalised with concrete
    recommended RPO/RTO/retention targets and the drill procedure.
  - +14 backend tests → 264 passed, 1 skipped; `ruff` / `bandit` clean.
  - `docs/CURRENT_STATE.md`, `docs/BACKUP_DISASTER_RECOVERY.md`,
    `docs/ACCEPTANCE.md` (new), `docs/CHANGELOG.md` updated.
