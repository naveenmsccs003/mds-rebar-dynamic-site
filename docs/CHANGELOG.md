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
