# Database Design

PostgreSQL is the system of record. This document defines the Phase 2
schema plan; it is implemented incrementally via Django migrations, one
app at a time, in the order listed in `DEVELOPMENT_PHASES.md`.

## Conventions (all apps)

- Every model: `created_at`, `updated_at` (auto), and, where content is
  editable by staff, `created_by` / `updated_by` FKs to `users.User`
  (nullable, `on_delete=SET_NULL`).
- Public-facing entities that must not leak sequential IDs get a `uuid`
  field (`default=uuid4`, `unique=True`, `db_index=True`) or a formatted
  public reference (e.g. quotations) in addition to the integer PK.
- Content models with a workflow get a `status` field
  (`DRAFT/REVIEW/APPROVED/PUBLISHED/ARCHIVED`) plus `published_at`,
  `scheduled_publish_at`.
- Soft delete (`is_deleted` + `deleted_at`) is used only where an audit or
  legal trail matters (enquiries, quotations, applications, users). Pure
  content (blog draft, portfolio) uses hard delete + the `ARCHIVED` status
  instead of soft delete, since versioning already gives history.
- Every FK used in a hot lookup path gets `db_index=True`; every list
  endpoint's default ordering field is indexed; composite indexes are
  added where a filter commonly combines two columns (e.g. portfolio
  `(country, service, is_published)`).

## Core apps → key tables

### `users` / `accounts` / `roles` / `permissions`
- `User` (custom user model, email as username, `is_active`,
  `last_login_ip`, `failed_login_count`, `locked_until`).
- `Role` (name, description) — `SuperAdmin, Admin, ContentManager, HR,
  Marketing, BusinessDevelopment, ResourceManager, KnowledgeBaseMember,
  Staff, Auditor`.
- `Permission` — Django's built-in permission framework
  (`app_label.codename`, e.g. `services.publish`) is used directly rather
  than reinventing one; `Role` is a `Group` subclass/wrapper mapping to
  Django `Group` + `Permission` so DRF's permission classes work natively.
- `UserRole` (M2M through table if role assignment needs metadata like
  `assigned_by`, `assigned_at`).

### `pages` (CMS / homepage / about / legal / settings)
- `PageSection` (page_key, section_key, display_order, JSON `content` for
  flexible section-level fields; publishing-workflow fields `status`,
  `published_at`, `scheduled_publish_at`, and `current_version` FK to
  `ContentVersion`; `updated_by`). Unique on `(page_key, section_key)`.
- `SiteSetting` (key, value, value_type) — global config (contact info
  defaults, feature flags) editable from admin, cached in Redis
  (invalidated on save via a `post_save`/`post_delete` signal).
- `ContentVersion` (generic FK, `snapshot` JSON, `edited_by`, `edited_at`)
  — one row per edit / workflow transition for any CMS model; see
  `apps.pages.versioning` (`snapshot()` / `rollback()`).
- `Redirect` (old_path [unique], new_path, is_permanent, note,
  created_by) — 301/302 kept when a public slug changes so links and
  rankings survive (`docs/SEO.md`); `apps.pages.redirects.create_redirect`
  keeps the graph flat (no 301→301 chains).

### `services`
- `Service` (name, slug [unique, indexed], short_description,
  long_description [rich text], hero_image FK→media, icon, capabilities
  [JSON or related `ServiceCapability`], process [related
  `ServiceProcessStep`], business_value, technology [M2M→`Technology`],
  standards_codes, deliverables, output_formats, display_order,
  is_published, seo_title, seo_description, seo_keywords, og_image FK).
- `ServiceFAQ` (service FK, question, answer, order).
- One reusable model + one reusable frontend template renders all
  services — never one React page per service.

### `industries`, `markets`
- `Industry` (name, slug, description, icon).
- `Country` → `Region` → `Office` (address, phone, email, map coords) →
  `OfficeContact`.

### `portfolio`
- `Project` (title, slug, client_industry FK→Industry, country FK,
  region FK, category, description, services M2M→Service, technology
  M2M, completion_year, is_featured, is_published, seo fields).
- `ProjectImage`, `ProjectDocument` (FK→media/documents, `is_public`).
- Indexes: `(is_published, country_id)`, `(is_published, is_featured)`,
  GIN index on a `search_vector` column for full-text search.
- List endpoint is always paginated + server-filtered — the full table is
  never sent to the browser.

### `resources`
- `Resource` (title, description, category
  [brochure/video/sample_drawing/technical_doc/case_study/whitepaper],
  file FK→`documents.Document`, thumbnail, external_url, access_type
  [public/restricted], published_date, download_count, is_published, seo
  fields).
- Restricted resources resolve to a signed URL at request time; the file
  itself is never served from a public/predictable path.

### `news` / `blogs` / `events` / `csr`
- Shared abstract base `PublishableContent` (title, slug, summary,
  content [sanitized rich text], featured_image, author FK→User,
  category, tags M2M, publish_date, scheduled_publish_at, status, seo
  fields, og fields) — `News`, `Blog`, `Event`, `CSRPost` each extend it
  via a concrete app-specific model (Django doesn't support true
  multi-table inheritance across apps cleanly, so this is implemented as
  a shared abstract model + per-app concrete tables, or one
  `content` app with a `content_type` discriminator — decided at
  Phase 4 implementation time based on query patterns).
- `ContentVersion` (content_type, object_id, snapshot JSON, edited_by,
  edited_at) — generic version history + rollback for every CMS-editable
  model.

### `careers` / `applications`
- `JobPosting` (title, department, location, employment_type, experience,
  skills [comma-separated string], description, responsibilities,
  requirements, benefits, application_deadline, is_active). `is_open`
  property = `is_active and (no deadline or deadline not passed)` — the
  public list hides closed postings, the public detail still renders them.
- `JobApplication` (job FK, name, email, phone, resume FK→Document
  [private], cover_letter, additional_info, uuid, status, assigned_to FK,
  ip_address, user_agent). **Phase 8 deviation:** added
  `idempotency_key` (blank default, partial unique constraint on
  non-blank values) so a replayed `POST /career-applications/` with an
  `Idempotency-Key` header returns the original application rather than a
  duplicate — `DATABASE_DESIGN` had only listed `idempotency_key` on
  `QuoteRequest`. Résumé validation + storage is `apps.applications.
  uploads` (server-side size / extension / content-sniff, randomised
  object key); object storage + malware scan stay Phase 10, per
  `FILE_STORAGE.md`.

### `quotations`
- `QuoteRequest` (public_reference `MDS-Q-{year}-{seq:06d}` [unique,
  indexed], name, company, email, phone, country FK, service FK,
  project_type, project_location, project_size, required_services M2M,
  timeline, message, status, assigned_to FK→User, idempotency_key
  [unique, indexed]).
- `QuoteAttachment` (quote FK, document FK).
- `public_reference` generation happens inside a DB transaction using a
  per-year sequence table (or `SELECT ... FOR UPDATE` on a counter row) to
  avoid races — never `count()+1`.

### `contact` (enquiries)
- `Enquiry` (public_reference, type [contact/business], name, email,
  phone, company, message, status
  [NEW/ASSIGNED/IN_PROGRESS/RESPONDED/CLOSED/SPAM], assigned_to FK,
  created_at).
- `EnquiryNote` (enquiry FK, author FK, note, created_at) — append-only
  internal thread, exposed at `/admin/enquiries/{id}/notes/`.

The `QuoteRequest` and `Enquiry` status machines are identical, so the
shared transition graph + per-transition permission rule live in
`apps.enquiries.lifecycle` (the `apps.enquiries` app has no model of its
own — it is the home for what the two enquiry-like apps share).

### `testimonials`, `clients`, `technology`
- Straightforward admin-editable content tables feeding the homepage
  "Trust", "Technology", and portfolio filters. No fabricated entries —
  seeded empty with `[CONTENT PLACEHOLDER — ADMIN TO COMPLETE]` until real
  data is supplied.

### `documents` / `media`
- `Document` (uuid, object_key [randomized, not the original filename],
  original_filename [stored, never used as the storage path], content_type,
  size, checksum, owner FK, visibility [public/private], status
  [pending/processed/failed], created_at).
- `DownloadLog` (document FK, user FK nullable, ip_address, user_agent,
  downloaded_at) — required for every private-file access.

### `notifications`
- `NotificationLog` (channel [email/etc.], recipient, template,
  related_object, status [queued/sent/failed], attempts, last_error) — so
  a failed email is retried by Celery and never silently lost or allowed
  to crash the request that triggered it.
- **Phase 9:** `apps.notifications.services.queue()` is the one entry
  point (writes the QUEUED row, dispatches `notifications.
  send_notification`); the Celery task renders
  `templates/notifications/email/<template>.txt`, sends, and records
  SENT / FAILED + `attempts` / `last_error`, retrying with backoff. The
  Phase 8 job-application alert was moved onto it.

### `audit`
- `AuditLog` (actor FK nullable [system actions], action, entity_type,
  entity_id, timestamp, ip_address, user_agent, before JSON, after JSON).
- Append-only: no update/delete permission for any role except a
  DB-level retention job; enforced via DRF permissions (no
  `PUT/PATCH/DELETE` route exists on the audit viewset) — not just app
  logic.

### `analytics`
- Aggregated/rollup tables populated by Celery (daily enquiry counts,
  resource download counts, etc.) — raw event storage stays lean and is
  archived rather than queried directly at dashboard-render time once
  volume grows.

### `search`
- No dedicated tables in Phase 1 beyond `search_vector` columns on the
  searchable models; a `SearchProvider` service class wraps the actual
  query so the call sites don't know whether they're hitting Postgres FTS
  or a future external search engine.

## Implementation notes (Phase 2)

A few deliberate deviations from the plan above, made while implementing
it and left here so the plan and the code don't drift apart silently:

- **`OfficeContact` was dropped.** `Office` already carries `phone` and
  `email`; a separate contact table would have been speculative until a
  real "multiple contacts per office" requirement shows up (spec §56
  "avoid premature abstraction").
- **`MediaAsset` (in `media`) wraps `documents.Document`** rather than
  duplicating file metadata: `Document` is the generic, storage-agnostic
  file record (used directly for resumes/brochures/private files);
  `MediaAsset` adds the presentational fields images need (alt text,
  caption, width/height) via a one-to-one. Anywhere the plan says an
  "image" FK (service hero image, project image, featured image, OG
  image, logos), the model points at `MediaAsset`, not `Document`
  directly.
- **`News`/`Blog`/`Event`/`CSRPost`** are concrete Django models that
  each inherit an abstract `PublishableContent` (in `pages`), rather than
  a single generic-content-type table — simpler to query and index per
  content type, and Django's abstract-base-class inheritance already
  gives the "define once" property the plan was after. A shared `Tag`
  model (in `pages`) is M2M'd from each.
- **Publish permissions use Django's `Meta.permissions`**, e.g.
  `services.publish_service`, rather than a separately modeled
  permission registry — this is the idiomatic Django way to get a
  queryable `auth.Permission` row per action without inventing a parallel
  system (see `docs/RBAC_DESIGN.md`).
- **`roles`, `permissions`, `accounts`, `analytics`, `search` have no
  models yet**, by design: `roles` only ships a data migration seeding
  the ten groups from `docs/RBAC_DESIGN.md`; `permissions` will hold DRF
  permission classes (Phase 3); `accounts` will hold auth *views*, not
  models (Django's built-in password-reset token generator needs no
  storage); `analytics` rollup tables and `search`'s `SearchVectorField`
  columns are added in the phases that actually consume them (14 and 11
  respectively) rather than guessed at now.
- **Quote/enquiry reference generation** (`MDS-Q-...` / `MDS-E-...`) is
  implemented exactly as planned — a per-year counter row locked with
  `select_for_update()` inside a transaction — and was verified against
  a real PostgreSQL instance (not just SQLite, which has no real
  row-level locking) with 8 concurrent threads racing for the same
  year's counter and receiving 8 distinct, sequential references.

## Implementation notes (Phase 4)

- **`PageSection` gained the workflow/versioning fields** `published_at`,
  `scheduled_publish_at` (indexed with `status`), and `current_version`
  (FK → `ContentVersion`), plus the custom permission
  `pages.publish_pagesection` (`Meta.permissions`). `ContentVersion` and
  `Redirect` were already-planned tables; `Redirect` is added now (model
  + helper) though the middleware that serves the 301s is a later phase.
- **The publishing workflow is generic, not per-model.**
  `apps.pages.workflow.transition()` drives any model with a `status`
  (`PublishStatus`) field through DRAFT → REVIEW → APPROVED → PUBLISHED →
  ARCHIVED, snapshotting + writing an `AuditLog` row on every move.
  `change_<model>` covers the review states; `publish_<model>` is
  required for anything that changes what the public sees (→ PUBLISHED,
  un-publish, archive a live page). Phase 4 wires it to `PageSection`;
  Services / News / Blog / Event / CSR / LegalDocument adopt the same
  two functions in their own phases. The finer-grained
  `review`/`unpublish`/`archive`/`rollback` permissions sketched in
  `RBAC_DESIGN.md` are collapsed to `change` + `publish` for now and can
  be split out later without a data migration (`sync_roles` re-resolves).
- **Versioning stores a full field snapshot**, not a diff
  (`apps.pages.versioning.serialize_instance` — local concrete fields as
  `<name>_id` for FKs, M2M as PK lists under `__m2m__`, datetimes ISO).
  `rollback()` reapplies a snapshot and is itself recorded as a new
  version, so the current state is never only reconstructable by
  replaying diffs.
- **Rich-text sanitisation** (`apps.pages.sanitize.sanitize_html`, `bleach`
  allow-list) drops `<script>`/`<style>`/`<iframe>`, every `on*`
  handler, and non-`http(s)/mailto/tel` URLs; `style` attributes are
  disallowed outright (no CSS parser to vet them). `SanitizedHTMLField`
  (a DRF serializer field) is the reuse hook for content models with an
  HTML `TextField`; `PageSection.content` is structured JSON, so its
  serializer sanitises string values held at `*_html` keys.
- Verified on SQLite in the build environment (no PostgreSQL client
  available there); introduces no PG-specific SQL — CI runs the suite on
  PostgreSQL.

## Performance rules applied throughout
- `select_related` for FK, `prefetch_related` for M2M/reverse-FK, on every
  list/detail queryset.
- No endpoint returns an unbounded queryset; every list view paginates.
- Composite/partial indexes added as real query patterns emerge in each
  phase's implementation — not speculatively for every column.
