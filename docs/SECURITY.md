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

Phase 8 — the public career-application résumé is the first upload path.
`apps.applications.uploads` enforces `RESUME_UPLOAD_MAX_BYTES`
(default 5 MB), an extension allow-list (`pdf` / `doc` / `docx`), and a
leading-byte signature check (`%PDF-`, OLE2, ZIP) so a mislabelled or
disguised file is rejected; the stored key is a random UUID under a
private prefix, and the `Document` is left `status=pending`. `libmagic`
is intentionally not a dependency — the signature check covers the
allowed types. Full MIME sniffing + malware scanning + presigned uploads
land with object storage in Phase 10 (`uploads.scan_hook` is the
attach point); the upload-validation audit is Phase 12.

## Rate limiting / anti-spam
Throttling (Redis-backed) on login, password reset, quote/contact/career
forms, uploads, search, and general public API traffic. Honeypot fields
and duplicate-submission detection on public forms; CAPTCHA reserved as a
defense-in-depth layer, not the only control.

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
