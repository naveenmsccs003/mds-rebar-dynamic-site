# RBAC Design

## Principle
The frontend hiding a button is a UX convenience only. Every
security-relevant decision is re-checked on the backend, on every request,
against the authenticated user's actual permissions.

## Roles (initial)
`SuperAdmin, Admin, ContentManager, HR, Marketing, BusinessDevelopment,
ResourceManager, KnowledgeBaseMember, Staff, Auditor`

Roles are implemented as Django `Group`s (or a thin `Role` model wrapping
`Group`) holding a set of Django `Permission`s, so DRF's standard
permission machinery (`request.user.has_perm(...)`) works without a
bespoke authorization engine.

## Permission naming
`<app_label>.<action>_<model>` mapped conceptually to the spec's
`domain.action` shorthand, e.g.:
```
services.view / services.create / services.edit / services.delete / services.publish
portfolio.view / portfolio.create / portfolio.edit / portfolio.delete
enquiries.view / enquiries.assign / enquiries.respond / enquiries.close
users.view / users.create / users.edit / users.disable
content.view / content.create / content.edit / content.review / content.publish / content.unpublish / content.archive / content.rollback
audit.view
```

## Suggested default role → permission mapping (adjust as real usage emerges)
| Role | Notable permissions |
|---|---|
| SuperAdmin | all |
| Admin | all except destructive user/role deletion, audit edit (nobody gets audit edit) |
| ContentManager | content.*, services.*, portfolio.* (not publish, unless explicitly granted) |
| Marketing | content.view/create/edit, testimonials.*, clients.* |
| BusinessDevelopment | enquiries.*, quotations.* |
| HR | careers.*, applications.* |
| ResourceManager | resources.*, documents.* |
| KnowledgeBaseMember | resources.view (restricted content) |
| Staff | baseline authenticated access, no admin write perms by default |
| Auditor | audit.view only, read-only everywhere else |

## Enforcement points
1. **DRF `permission_classes`** on every viewset/view — declarative,
   checked before the view body runs.
2. **`get_queryset()` / `has_object_permission()`** for row-level checks
   (e.g., a `BusinessDevelopment` user can only see enquiries assigned to
   their team, if that rule is adopted).
3. **Serializer field-level control** where a role should see a record but
   not every field (e.g., internal notes hidden from `KnowledgeBaseMember`).
4. **Publishing workflow gating** — `content.edit` lets someone change a
   draft; `content.publish` is required to move `DRAFT/REVIEW/APPROVED` →
   `PUBLISHED`. These are deliberately separate permissions so editors
   cannot self-publish unless explicitly granted.

## Auditing
Every permission-sensitive action (user created/edited/disabled, role
changed, content published, quote assigned, document downloaded, login
success/failure, password changed) writes an `AuditLog` row. Audit
records have no update/delete endpoint for any role.

## Session & auth hardening
- Django's PBKDF2/Argon2 password hashers (never plaintext, never
  reversible encryption).
- Login throttling + account lockout after repeated failures.
- Session expiration, secure/httpOnly/SameSite cookies, CSRF protection on
  all state-changing requests.

## Implementation (Phase 3)

### Auth endpoints — `apps.accounts`, mounted at `/api/v1/auth/`
| Method + path | Auth | Notes |
|---|---|---|
| `GET  /csrf/` | public | sets the `csrftoken` cookie for the SPA |
| `GET  /session/` | session | current user + `roles` + `permissions`; **401** when anonymous (SPA's cue to show login) |
| `POST /login/` | public | email + password; CSRF-protected; throttle scope `login`; progressive lockout |
| `POST /logout/` | session | flushes the session |
| `POST /password/change/` | session | needs `current_password`; keeps the session (`update_session_auth_hash`) |
| `POST /password/reset/` | public | throttle `password-reset`; always the same response (no user enumeration) |
| `POST /password/reset/confirm/` | public | Django `default_token_generator`, 24 h TTL; also clears any lockout |

Error bodies use the `docs/API_DESIGN.md` envelope with specific codes:
`INVALID_CREDENTIALS` (401), `ACCOUNT_LOCKED` (403, includes
`retry_after` seconds), `INVALID_RESET_TOKEN` (400),
`AUTHENTICATION_REQUIRED` (401). `config.api_authentication.SessionAuthentication`
adds a `WWW-Authenticate` header so unauthenticated requests get 401, not
DRF's default 403.

### Brute-force lockout
Per-account, progressive, enforced on `users.User.failed_login_count` /
`locked_until` (state-machine methods live on the model:
`register_failed_login`, `register_successful_login`, `clear_lockout`,
`lockout_seconds_remaining`). After `AUTH_LOCKOUT_THRESHOLD` (default 5)
consecutive failures the account locks for `AUTH_LOCKOUT_BASE_SECONDS`
(default 60), doubling per further failure up to
`AUTH_LOCKOUT_MAX_SECONDS` (default 3600). A correct password during the
lock window is still refused. This sits on top of the per-IP Redis
`login` DRF throttle, not instead of it. Every login success/failure/block,
logout, password change, and reset writes an `AuditLog` row
(`auth.login.succeeded` / `auth.login.failed` / `auth.login.blocked` /
`auth.logout` / `auth.password.changed` / `auth.password_reset.requested`
/ `auth.password_reset.completed`).

### DRF permission classes — `apps.permissions.permissions`
- `IsActiveUser` — authenticated **and** `is_active`.
- `HasModelPermission` — `DjangoModelPermissions` plus a `view_<model>`
  requirement for reads and no anonymous fall-through; model taken from
  the view's queryset.
- `HasRequiredPermissions` — checks an explicit `required_permissions`
  list / `required_permissions_map` (by HTTP method or DRF action) on the
  view, for non-CRUD verbs like `publish`.
- `IsAuditReader` — `audit.view_auditlog` for reads; every write method
  refused unconditionally (append-only, no exception for SuperAdmin).
- `ReadOnly` — safe methods only, for composing.

`apps.permissions.introspection.permissions_payload(user)` returns
`{roles, permissions, is_superuser, is_staff}` for the `/session/`
endpoint.

### Role → permission seeding
`apps.roles.role_permissions.ROLE_PERMISSIONS` is the declarative map
(selector syntax: `"ALL"`, `"<app>"`, `"<app>:view,add,change"`,
`"<app>.<codename>"`); `Admin` is `ALL` minus `ADMIN_DENIED` (user/role
deletion, raw permission rows, all audit writes). Applied by the
idempotent `python manage.py sync_roles` (`--dry-run` supported) — **not**
a data migration, because the default `add/change/delete/view`
permissions are created by a `post_migrate` signal that has not fired
while migrations run. Run `sync_roles` on every deploy and after any
migration that adds a model or a custom permission.
