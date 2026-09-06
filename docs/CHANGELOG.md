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
