# MDS Rebar — Enterprise Website & Management Platform

A dynamic, secure, API-driven platform for MDS Rebar's public website,
CMS, and admin/management system. See `/docs` for the full architecture,
database, API, RBAC, security, and phased delivery plan before making
changes — this is built in disciplined phases (`docs/DEVELOPMENT_PHASES.md`),
not as a one-shot build.

## Stack

- **Frontend:** React + TypeScript + Vite, React Router, TanStack Query,
  React Hook Form + Zod — `frontend/`
- **Backend:** Django + Django REST Framework — `backend/`
- **Database:** PostgreSQL
- **Cache/queue:** Redis + Celery
- **Object storage:** provider-independent abstraction (S3-compatible)

## Repository layout

```
backend/    Django project (config/) + one app per domain (apps/<domain>)
frontend/   Vite + React + TypeScript SPA, feature-based structure
docs/       Architecture, database, API, RBAC, security, and phase plans
docker-compose.yml   Local dev: postgres, redis, backend, worker, scheduler, frontend
```

## Local development

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env   # then edit values
python manage.py migrate
python manage.py runserver
```
Note: `requirements/*.txt` and the Dockerfiles target Python 3.12 on
Django 5.2.x (the current supported series) — use 3.12 for anything
beyond local scaffolding checks.

Without a running PostgreSQL/Redis, `USE_SQLITE_FOR_LOCAL_DEV=True` in
`.env` lets `manage.py check`/basic local dev run against SQLite — never
use this outside of local development.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Everything together
```bash
docker compose up
```

## Testing

```bash
cd backend  && pytest && ruff check . && bandit -c pyproject.toml -r apps config
cd frontend && npm run lint && npm run test && npm run build
cd frontend && npm run e2e          # Playwright, public journeys (API stubbed)
```

## CI/CD

`.github/workflows/ci.yml` is the full pipeline (`docs/CI_CD.md`):
lint + static analysis → unit tests → **integration tests on real
Postgres/Redis service containers** (`config.settings.ci`) → Playwright
E2E → multi-stage Docker build (`--target prod`) → push to GHCR and
deploy to **staging** (auto on `main`) → smoke tests → **production**
(manual approval via the `production` GitHub Environment).

To finish wiring a real deployment:
- add required status checks (`backend`, `frontend`, `integration`,
  `e2e`) to the `main` branch protection rule;
- configure the `staging` / `production` GitHub Environments (required
  reviewers on `production` = the manual gate) and the `STAGING_URL` /
  `PRODUCTION_URL` / `SMOKE_API_URL` variables;
- replace the `echo` placeholders in `deploy-staging` / `deploy-production`
  with the platform's deploy command (each must run
  `manage.py migrate --noinput` before cutting traffic over).

## Documentation

Start with `docs/CURRENT_STATE.md` and `docs/TARGET_ARCHITECTURE.md`,
then the plans for the layer you're touching (`DATABASE_DESIGN.md`,
`API_DESIGN.md`, `RBAC_DESIGN.md`, `UI_DESIGN_SYSTEM.md`, `SECURITY.md`,
etc.). `docs/DEVELOPMENT_PHASES.md` defines the build order and the
per-phase acceptance checklist — do not skip ahead of the current phase.

## Business content

Business facts not present in the MDS Rebar specification (statistics,
certifications, awards, client names, project values, employee counts,
office details) are never fabricated. They appear as
`[CONTENT PLACEHOLDER — ADMIN TO COMPLETE]` until supplied and entered
through the CMS.
