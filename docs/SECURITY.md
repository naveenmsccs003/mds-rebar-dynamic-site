# Security

## Layered model
CDN/WAF → Load Balancer → Application security → Authentication →
Authorization → Database security → Object storage security →
Audit/monitoring. A failure at any single layer must not be the only
thing standing between an attacker and data.

## Transport & headers
HTTPS everywhere, HSTS, secure/httpOnly/SameSite cookies, CSRF protection
on all state-changing requests, restrictive CORS (explicit allowed
origins, never `*` for credentialed requests), Content-Security-Policy,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (clickjacking),
`Referrer-Policy`. Django's `SecurityMiddleware` + `django-csp` configured
per environment (relaxed in dev, strict in staging/prod).

**Implemented (Phase 12).** Django's `SecurityMiddleware` provides HSTS
(`SECURE_HSTS_*`), the SSL redirect, `nosniff` and `Referrer-Policy`;
`XFrameOptionsMiddleware` sends `X-Frame-Options: DENY`; staging /
production set `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` /
`SECURE_SSL_REDIRECT` and `SECURE_PROXY_SSL_HEADER` (TLS terminates at
the proxy). `config.security.SecurityHeadersMiddleware` adds the two
Django does not: a strict **Content-Security-Policy**
(`default-src 'self'`; no inline/remote script; `style-src` allows
`'unsafe-inline'` only for the Django admin; `frame-ancestors 'none'`)
and a **Permissions-Policy** turning off unused browser features. CSP is
report-only in staging (`CSP_REPORT_ONLY`, default on there), enforced in
production; the OpenAPI schema / Swagger paths are exempt (CDN assets,
internal tooling, robots-disallowed). `django-csp` was evaluated — a
~40-line middleware covers the Django-served surface without the
dependency. The public SPA is served by its own host and ships its own
CSP. Production also drops DRF's `BrowsableAPIRenderer` (JSON only).
`manage.py check --deploy` is clean of `security.W*` findings with a real
`DJANGO_SECRET_KEY`.

## AuthN
Django's PBKDF2/Argon2 password hashing (never plaintext, never
reversible encryption). Login/password-reset throttled and
brute-force-protected (progressive lockout). Session or JWT tokens with
rotation as decided in `API_DESIGN.md`.

## AuthZ
Backend permission checks on every protected endpoint (see
`RBAC_DESIGN.md`). Frontend visibility rules are UX only and are never
the actual security boundary.

## Input & injection
All input validated server-side (DRF serializers, never trusting
client-side validation alone). All queries via the Django ORM
(parameterized) — no raw SQL string concatenation. Rich text sanitized
(`bleach`/`nh3`-equivalent allow-list) before storage and again before
render.

## File uploads
Server-side validation of size, extension, and actual MIME/content
(never trust the browser-supplied filename or `Content-Type`).
Randomized storage object names; original filename kept only as
metadata. Private files require an authorization check and a
short-lived signed URL — never a predictable public path. See
`FILE_STORAGE.md`.

Phase 8 introduced the first upload path (the public career-application
résumé). Phase 10 generalised it: `apps.documents.validation` holds the
per-category policies (size ceiling, extension allow-list, leading-byte
signature check — `libmagic` intentionally not a dependency),
`apps.documents.services.store_bytes` / `issue_upload` do the storing
(random-UUID key under a `private/` or `public/` prefix, SHA-256,
`status=pending`), and `documents.scan_document` (Celery) is the
malware-scan hook — a detection deletes the object and marks the row
`failed`; nothing is downloadable while `pending`. `apps.applications.
uploads` is now a thin adapter over this. Real AV integration + the
upload-validation audit remain Phase 12.

## Rate limiting / anti-spam
Throttling (Redis-backed) on login, password reset, quote/contact/career
forms, uploads, search, and general public API traffic. Honeypot fields
and duplicate-submission detection on public forms; CAPTCHA reserved as a
defense-in-depth layer, not the only control.

**Implemented.** `ScopedRateThrottle` for the sensitive flows —
`login` 10/min, `password-reset` 5/min, `quote-requests` / `contact` /
`career-applications` 10/min, `uploads` 20/min, `search` 60/min — plus a
baseline `AnonRateThrottle` (`THROTTLE_ANON`, default 120/min per IP) and
`UserRateThrottle` (`THROTTLE_USER`, default 600/min) on **all** other
API traffic including GETs (Phase 12). Honeypot + Idempotency-Key +
10-minute same-email dedupe on every public form (Phases 8–9). Rejected
uploads log to the `security` logger (Phase 12) — a stream of them is a
probing signal.

## Secrets
All credentials via environment variables (`django-environ`), never
committed. `.env.example` ships with placeholders only. Frontend code
never contains API secrets, DB credentials, or private keys.

## Audit logging
Sensitive actions (user/role changes, publishing, document access, login
attempts, permission changes) are written to an append-only `AuditLog`
with actor, action, entity, timestamp, IP/user-agent where relevant, and
before/after state where relevant. No role can edit or delete audit
records through the API.

**Coverage review (Phase 12).** `AuditLog` actions in place:
`auth.login.{failed,blocked}` / `auth.logout` / `auth.password.*`
(Phase 3); `*.transition` for every CMS-workflow publish/unpublish
(Phase 4+); `application.{submitted,updated}` (Phase 8);
`quote_request.{submitted,updated}` / `enquiry.{submitted,updated}`
(Phase 9); `document.{downloaded,scanned}` (Phase 10). The API layer
enforces append-only — there is no `PUT/PATCH/DELETE` route on the audit
viewset, and `ADMIN_DENIED` removes `audit.{add,change,delete}_auditlog`
from every role. **Known gaps, closed when the owning surface ships:**
user/role/permission changes made through the *Django admin* are
recorded in Django's native `django_admin_log` (`LogEntry`), not
`AuditLog` — the admin SPA's user-management API (a later phase) will
write `AuditLog` rows directly; `sync_roles` runs are deploy-time and
logged by the deploy pipeline.

## Application logging
Structured logs (request ID, timestamp, endpoint, method, status,
duration, user ID where relevant, error code). Never logs passwords,
tokens, secrets, or unnecessary personal data.

## Public identifiers
Sequential internal IDs are not exposed for enquiries, quotes,
applications, or documents — UUIDs / public reference numbers / slugs
are used instead (`MDS-Q-2026-000001`, `/services/rebar-detailing`).

## Data privacy
Personal data (resumes, contact details, enquiry content) is stored with
restricted access, is not logged unnecessarily, and is never exposed
through a public API.

## What is explicitly never done
Plaintext or reversibly-encrypted passwords; secrets committed to the
repo; API keys shipped in frontend bundles; trusting frontend-only
permission checks; trusting client filenames/MIME types; building SQL via
string concatenation; direct DB coupling between the CMS and Trackmate.
