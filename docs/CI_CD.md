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
