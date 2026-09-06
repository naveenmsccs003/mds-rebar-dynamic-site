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
