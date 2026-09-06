# Current State Report

**Date:** 2026-09-06
**Repository:** `mds_rebar_dynamic_site` — branch `main`, remote
`github.com/naveenmsccs003/mds-rebar-dynamic-site`.
**Status:** Phases 1–16 of `docs/DEVELOPMENT_PHASES.md` complete. This
supersedes the greenfield report that occupied this file through Phase 1.

## 1. Summary
A Django/DRF backend + a React/Vite public SPA, built in 16 phases with a
test + docs gate at each. The **public website and its API are
feature-complete**; the **staff/admin SPA is not built** (its API surface
is, and is tested). Everything runs locally via `docker compose`; the CI
pipeline builds production images and has placeholder deploy steps ready
to wire to a hosting platform.

## 2. Backend (`backend/`)
- **Auth (Phase 3):** session-cookie API under `/api/v1/auth/`, Argon2
  hashing, per-account progressive lockout + per-IP throttle, full audit
  trail. No bearer tokens.
- **RBAC (Phase 3):** 10 roles as `auth.Group`s; a declarative
  role→permission map applied by `manage.py sync_roles`; reusable DRF
  permission classes; every protected endpoint re-checks on the server.
- **CMS (Phase 4):** generic DRAFT→REVIEW→APPROVED→PUBLISHED→ARCHIVED
  workflow with `change`/`publish` permission split, `ContentVersion`
  snapshots + rollback, `bleach` HTML sanitisation, scheduled publishing
  (Celery beat), redirects.
- **Content APIs:** services (Phase 6); portfolio / resources / news
  (Phase 7); careers postings + applications (Phase 8); quote + contact +
  enquiries with generated public references, notifications, and a shared
  lead lifecycle (Phase 9). All public lists paginated + server-filtered.
- **Documents/Media (Phase 10):** storage abstraction
  (`apps.documents.storage`) — local signed backend for dev/test, S3
  backend for prod; presigned-style upload, authorized signed download
  with `DownloadLog` + audit, Celery malware-scan hook; `MediaAsset`
  wraps a public `Document` and resolves a stable URL.
- **SEO/Search (Phase 11):** `/api/v1/search/` via a provider
  abstraction (Postgres FTS in real environments, `icontains` fallback
  for SQLite), `/sitemap.xml`, `/robots.txt`.
- **Hardening (Phase 12):** strict CSP + Permissions-Policy middleware,
  baseline anon/user throttles on all traffic, `SECURE_PROXY_SSL_HEADER`,
  no browsable API in prod, rejected-upload security logging, documented
  audit-log coverage.
- **Performance (Phase 14):** query-count regression guards, a
  version-namespaced response cache with signal invalidation on the
  public content endpoints.
- **Operability (Phase 16):** `/health/` (liveness) + `/ready/`
  (DB + cache + migrations gate readiness; broker reported), the
  acceptance suite, the restore drill.

## 3. Frontend (`frontend/`)
Public marketing site: home / about / legal (CMS-driven, Phase 5),
services, portfolio, resources, news, careers (+ application form),
contact, request-a-quote, global search. Design-system primitives,
`SEOHead` (React 19 head hoisting), `JsonLd` structured data, per-route
code splitting, `web-vitals` reporting. No admin UI.

## 4. Database
PostgreSQL is the system of record. Models + migrations for every domain
app exist since Phase 2. The unit test suite runs on SQLite; a CI
`integration` job runs the full suite on real Postgres + Redis.

## 5. Tests
252 backend (`pytest`, incl. integration + query-perf + response-cache +
acceptance + health), 91 frontend (`vitest`, incl. MSW hook tests),
4 Playwright public-journey E2E + a deploy smoke suite. `ruff` + `bandit`
+ `pip-audit` gate the backend; `oxlint` + `npm audit` the frontend.

## 6. CI/CD (`.github/workflows/ci.yml`)
lint/static-analysis → unit → integration (PG/Redis) → backup-drill →
E2E → docker build (`--target prod`, push to GHCR on `main`) →
deploy-staging (auto, smoke) → deploy-production (manual environment
gate). Deploy steps are `echo` placeholders.

## 7. Deferred / not built (by design)
- **Staff/admin SPA** — the API is complete and tested; the React admin
  app, and its E2E journeys (login, RBAC, publishing, user/permission
  management, audit visibility), are a follow-on project.
- **Real deployment** — hosting platform, managed Postgres/Redis, S3
  bucket, DNS/TLS, and the concrete deploy commands. RTO and final
  backup retention are stated once a provider is chosen
  (`BACKUP_DISASTER_RECOVERY.md`).
- **Business content** — every business fact
  (`[CONTENT PLACEHOLDER — ADMIN TO COMPLETE]`) is entered through the
  CMS, not seeded.
- **CDN image pipeline** (`srcset`/compression), marketing-route
  prerendering (`SEO.md`), a real malware scanner (`FILE_STORAGE.md`
  hook is in place), and scale options (read replicas, partitioning,
  dedicated search engine) — documented as later work, not built
  preemptively.
- **Blogs / Events / CSR** models exist (Phase 2) but have no API/UI yet
  — they reuse the `PublishableContent` + `ArticleTemplate` shapes when
  built.

## 8. How to run
`docker compose up`, or per-service: `backend/` → `pip install -r
requirements/dev.txt && manage.py migrate && manage.py runserver`;
`frontend/` → `npm install && npm run dev`. See `README.md`.
