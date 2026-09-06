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
