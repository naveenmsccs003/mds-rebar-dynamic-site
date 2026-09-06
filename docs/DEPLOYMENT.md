# Deployment

## Environments
Development, Testing, Staging, Production — fully separated databases,
object storage buckets, and secrets. The production database is never
used for development or testing.

## Components
- `frontend`: static build served via CDN/static hosting.
- `backend`: gunicorn behind a reverse proxy (nginx or platform LB),
  running Django/DRF.
- `worker`: Celery worker process(es).
- `scheduler`: Celery Beat for scheduled jobs (publishing, digests).
- `postgres`, `redis`: managed services in staging/production where
  possible; containers in local dev.
- Object storage: environment-specific buckets (dev/staging/prod never
  share a bucket).

## Local development
`docker-compose.yml` brings up `frontend`, `backend`, `postgres`,
`redis`, `worker`, `scheduler` with hot-reload for both frontend and
backend. See repository root `docker-compose.yml`.

## Release process
Build once per commit (Docker images for backend/worker; a static bundle
for frontend), promote the same artifact through staging → production
rather than rebuilding per environment, to guarantee what was tested is
what ships.

## Health checks
`/health/` (process is up) and `/ready/` (dependencies — DB, Redis —
reachable) exposed by the backend for the load balancer/orchestrator.

## Rollback
Previous release artifact/image is kept available; rollback is a
redeploy of the previous artifact plus, if needed, a reverse migration
reviewed for safety (destructive migrations are avoided or split into
safe multi-step migrations).
