# Testing

## Backend (pytest-django / Django TestCase)
- **Model tests:** constraints, validation, computed fields, versioning.
- **Serializer tests:** validation rules, field-level permission
  filtering.
- **Permission tests:** every protected endpoint denies unauthorized/
  under-permissioned requests and allows correctly-permissioned ones —
  including object-level checks, not just "is authenticated".
- **API tests:** each endpoint's success path, validation errors,
  pagination, and error envelope shape.
- **Integration tests:** multi-step flows (quote submission →
  attachment → audit event → notification; publishing workflow
  draft→review→approved→published).

## Frontend (Vitest + React Testing Library)
- Component tests for shared primitives (forms, tables, modals) covering
  loading/empty/error/success states.
- Form tests (React Hook Form + Zod) for validation and submission
  behavior.
- API integration tests against a mocked API layer (MSW) for the
  TanStack Query hooks.

## End-to-end (Playwright)
Critical journeys: login, RBAC (a lower-privileged user cannot reach an
admin-only action, via UI *and* direct API call), quote submission,
contact/enquiry submission, publishing workflow, file upload, private
file access authorization, user management, permission management, audit
log visibility.

## Security checks in CI
Dependency vulnerability scanning, `bandit`/equivalent static analysis on
the backend, and a lint pass that fails the build on obvious
anti-patterns (raw SQL string formatting, `eval`, disabled CSRF, etc.).

## Gate
A phase is not considered complete until its relevant tests exist and
pass — per `DEVELOPMENT_PHASES.md`'s per-phase acceptance checklist.

## Implemented (Phase 13)

**Backend** — every phase shipped model / serializer / permission / API
tests (240 tests, run on SQLite; PG-specific behaviour is covered by a
provider abstraction, see `SEARCH.md`). `tests/test_integration.py`
walks four cross-cutting journeys end to end: publishing workflow
(draft→review→approved→published, asserting audit rows + version
snapshots + public visibility at each hop), quote submission → both
notifications → assignment → close, document upload → PUT → complete →
scan → authorized download (+ `DownloadLog`), career application → résumé
stored/scanned → HR download. Enabled without adding fixtures: pytest +
`pytest-django`.

**Static analysis / security in CI** — `ruff` (a narrow rule set:
pyflakes, `flake8-bandit`, `flake8-django`, mutable-default args, stray
`print`, unused `noqa` — config in `backend/pyproject.toml`), `bandit`
(`-r apps config`), and `pip-audit` (advisory) all run in the `backend`
CI job. Django was bumped to 5.2.x during this phase to clear seven
`pip-audit` CVEs.

**Frontend** — 91 vitest tests. Component tests cover the shared
primitives' loading/empty/error/success states; feature tests mock the
`api.ts` modules. Added an MSW layer (`src/test/msw/`, started in
`src/test/setup.ts` with `onUnhandledRequest: "bypass"` so it coexists):
`src/api/request.test.ts` exercises the real envelope-unwrap + error
mapping over HTTP, and `features/services/hooks.test.tsx` drives the
TanStack Query hooks against it.

**End-to-end (Playwright)** — `frontend/e2e/`, config in
`playwright.config.ts` (builds the SPA, serves it with `vite preview`).
Public journeys run with the API stubbed per test via `page.route`
(`e2e/support.ts`), so they need no backend and run in CI (the `e2e`
job): home nav, global search (URL state + result link), contact form
(validation → success + reference), careers list → detail → application
form validation. The admin-side journeys in the list above (login, RBAC
via UI + direct API, publishing, user / permission management, audit
visibility) are added when the admin SPA ships.
