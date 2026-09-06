# CI/CD

## Pipeline
```
Git Push -> Lint -> Type Check -> Unit Tests -> Security Checks -> Build
         -> Integration Tests -> Docker Build -> Staging Deploy
         -> Smoke Tests -> Production Approval (manual) -> Production Deploy
```

## Stages
- **Lint:** ESLint (frontend), flake8/ruff (backend).
- **Type check:** `tsc --noEmit` (frontend); optional `mypy` (backend).
- **Unit tests:** Vitest (frontend), pytest-django (backend).
- **Security checks:** dependency audit (`npm audit`, `pip-audit`),
  `bandit` static analysis.
- **Build:** Vite production build; Django `collectstatic` +
  container image build.
- **Integration tests:** DRF API test suite against a real Postgres/Redis
  service in the CI runner.
- **Docker build:** backend/worker images tagged with the commit SHA.
- **Staging deploy:** automatic on merge to `main`.
- **Smoke tests:** a small Playwright suite hitting staging's critical
  paths (home loads, login works, health endpoint OK).
- **Production approval:** manual gate — no automatic production deploy.
- **Production deploy:** promote the exact staging-tested artifact.

## Rule
A broken build (failing lint, types, tests, or security checks) never
reaches `main`/staging/production. Implemented as required GitHub Actions
checks (or equivalent) blocking merge.

## Implemented (Phase 15)
`.github/workflows/ci.yml` realises the pipeline as these jobs:

| Job | What | Gate |
|---|---|---|
| `backend` | `ruff` + `bandit` + `pip-audit` (advisory) + `manage.py check` + `pytest` (SQLite) | required |
| `frontend` | `oxlint` + `vitest` + `tsc -b`/`vite build` + `npm audit` (advisory) | required |
| `integration` | `pytest` under `config.settings.ci` against **Postgres 16 + Redis 7 service containers** (`migrate` first; the PG-only concurrency test now runs) | required |
| `e2e` | Playwright public journeys (API stubbed, `vite preview`) | required |
| `docker` | `needs: [backend, frontend, integration, e2e]` — build `backend`/`frontend` **`--target prod`** images (buildx + GHA cache); **push to `ghcr.io/<repo>/{backend,frontend}:<sha>` only on `main`** | — |
| `deploy-staging` | `if: main` — promote the SHA-tagged images, run `smoke.spec.ts` against `STAGING_URL` | GitHub `staging` environment |
| `deploy-production` | `needs: [deploy-staging]` — promote the *same* image | GitHub `production` environment (**required reviewers = the manual approval gate**) |

Repo-side configuration (not in code): the `main` branch protection
rule's required checks; the `staging` / `production` Environments and
their `STAGING_URL` / `PRODUCTION_URL` / `SMOKE_API_URL` variables; and
the platform deploy command that replaces the `echo` placeholders (each
runs `manage.py migrate --noinput` before cutover).
