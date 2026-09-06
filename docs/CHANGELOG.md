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
