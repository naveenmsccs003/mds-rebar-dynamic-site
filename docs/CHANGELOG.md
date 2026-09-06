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
