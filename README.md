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
Note: this repo's own sandbox venv was built against Python 3.14 for
convenience; `requirements/*.txt` and the Dockerfile target Python 3.12,
which is Django 5.1's supported/tested runtime — use 3.12 for anything
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
cd backend && pytest
cd frontend && npm run test
```

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
