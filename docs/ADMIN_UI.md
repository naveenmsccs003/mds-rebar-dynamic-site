# Admin UI

The staff/admin single-page app: a second route tree at `/admin` inside
the existing Vite app (`frontend/`). It shares the public site's axios
client, TanStack Query setup, design tokens, MSW test layer and CI, but
every `/admin/*` screen is a lazy chunk, so the public entry bundle
doesn't grow. The backend stays the security boundary
(`HasRequiredPermissions` on every viewset); everything the UI hides or
disables is UX only (docs/RBAC_DESIGN.md).

Built in sub-phases A1–A7 (see `CHANGELOG.md` → "Admin SPA").

## Route map

`frontend/src/app/adminRouter.tsx`. `login` is public; everything else
renders inside `<RequireAuth>` (401 → `/admin/login?next=<path>`) and
`AdminLayout`, and every section is wrapped in `<RequirePermission>`
(missing codename → a "Not permitted" panel, not a redirect).

| Path | Screen | Feature folder | Needs |
| --- | --- | --- | --- |
| `/admin/login` | Sign in | `features/auth/` | — |
| `/admin` | Dashboard ("needs attention" counts per visible queue) | `features/admin-dashboard/` | signed-in staff |
| `/admin/password` | Change password | `features/auth/` | signed-in staff |
| `/admin/cms/sections` | CMS page sections (JSON content, workflow, versions) | `features/admin-cms/` | `pages.view_pagesection` |
| `/admin/cms/settings` | Site settings | `features/admin-cms/` | `pages.view_sitesetting` |
| `/admin/cms/tags` | Tags | `features/admin-cms/` | `pages.view_tag` |
| `/admin/cms/redirects` | Redirects | `features/admin-cms/` | `pages.view_redirect` |
| `/admin/services` | Services (workflow + versions) | `features/admin-catalogue/` | `services.view_service` |
| `/admin/portfolio` | Portfolio projects (workflow + versions) | `features/admin-catalogue/` | `portfolio.view_project` |
| `/admin/news` | News (workflow + versions) | `features/admin-catalogue/` | `news.view_news` |
| `/admin/resources` | Resources | `features/admin-catalogue/` | `resources.view_resource` |
| `/admin/careers` | Job postings | `features/admin-catalogue/` | `careers.view_jobposting` |
| `/admin/quote-requests` | Quote requests (lifecycle + assignee) | `features/admin-inbox/` | `quotations.view_quoterequest` |
| `/admin/enquiries` | Enquiries (lifecycle + assignee + notes) | `features/admin-inbox/` | `contact.view_enquiry` |
| `/admin/applications` | Job applications (status, signed résumé link) | `features/admin-inbox/` | `applications.view_jobapplication` |
| `/admin/media` | Media library (upload, alt text, delete) | `features/admin-media/` | `media.view_mediaasset` |
| `/admin/users` | Users (create, roles, deactivate) | `features/admin-people/` | `users.view_user` |
| `/admin/roles` | Roles (read-only permission reference) | `features/admin-people/` | `auth.view_group` |
| `/admin/audit` | Audit log (filters, cursor paging, diff) | `features/admin-audit/` | `audit.view_auditlog` |
| `/admin/*` | Admin 404 | `pages/AdminNotFoundPage` | signed-in staff |

## Permissions → navigation and controls

The sidebar (`layouts/adminNav.ts`) lists an item only when the session
holds its codename (the same one the route gate and the list endpoint
require), so a role sees exactly the sections it can open. Inside a
screen, write controls follow the action's permission:

| Control | Rule | Behaviour when missing |
| --- | --- | --- |
| "New …" buttons | `<app>.add_<model>` | hidden |
| Save on an edit form | `<app>.change_<model>` | disabled, reason shown |
| `WorkflowBar` move | to/from PUBLISHED → `publish_<model>`, else `change_<model>` | disabled; a note names the missing codename |
| Inbox status / assignee (`LeadForm`) | `leadLifecycle.ts`: assign → `assign_*`, responded → `respond_*`, closed → `close_*`, else `change_*` (falls back to `change_*` when the model has no such verb) | Save disabled; an alert names the missing codename |
| Delete (applications, media, simple resources) | `<app>.delete_<model>` | hidden |
| Deactivate / reactivate user | `users.change_user` | hidden; also disabled for your own account |
| Audit log | read-only for everyone | no write controls exist |

A superuser passes every check (`usePermission`). A move the UI allows
but the server refuses (stale session, rule drift) shows the API's
error message in the form; nothing is assumed to have succeeded.

Role → permission assignments live in `backend/apps/roles/role_permissions.py`
and are applied with `manage.py sync_roles`; the Roles screen is a
read-only view of the result.

## Admin primitives contract (`src/components/admin/`)

| Component | Contract |
| --- | --- |
| `AdminDataTable` | Takes a TanStack Query result (`data` / `isPending` / `isError` / `refetch`) and renders loading (skeleton in a `role="status"` region), empty (`emptyLabel`), error (`ErrorState` with retry) or rows. Page-number footer for `Paginated<T>`; pass `pager` instead for a `CursorPage<T>` (audit log). With `onRowClick`, rows are focusable and open on click, Enter or Space. `toolbar` slot for filters / "New". |
| `FormDrawer` | Slide-over dialog (`role="dialog"`, `aria-modal`, labelled by `title`). Focus moves in on open, Tab is trapped inside, Escape or a backdrop click closes, focus returns to the opener. Nested drawers (media picker inside an edit drawer) close one at a time. |
| `ConfirmDialog` | `role="alertdialog"` for destructive or consequential actions. Focus starts on Cancel, is trapped, Escape cancels, focus returns to the trigger. `busy` disables both buttons. |
| `FormField` set | `TextField` / `TextAreaField` / `SelectField` / `CheckboxField`: a `<label>` around the control plus an inline error, with `aria-invalid` set when there's an error. |
| `WorkflowBar` | One button per `allowed_transitions` entry from the API (the graph isn't hard-coded), optional note, permission gating as above. |
| `VersionHistoryPanel` | Lists `ContentVersion`s with per-row rollback; its own loading and error states. |
| `DetailList` | Read-only `<dl>` for submitted / immutable data; empty rows are dropped unless `keepEmpty`. |
| `useDialogFocus` | The focus / keyboard hook behind `FormDrawer` and `ConfirmDialog`. Keys are handled on the dialog element (not `document`) and `onClose` is read through a ref, so a parent re-render never pulls focus away from a field. |

Feature-level building blocks: `features/admin-shared/crud.ts` (URL
helpers for list / get / create / update / remove / transition /
versions / rollback), `makeCrudHooks` and `makeWorkflowHooks` (query
keys `["admin", <resource>, …]`; a mutation invalidates the resource's
whole key space), and `SimpleResourcePage` (table + create/edit drawer
for plain resources).

List filters and the page (or `cursor`) live in the URL query string
(`useListParams`, or `useSearchParams` directly on the audit log, where
a filter change also drops the cursor), so a filtered view can be
bookmarked and survives a refresh.

## Accessibility

- A skip link plus `<main tabIndex=-1>` that takes focus on every route
  change (`AdminLayout`); the sidebar is a labelled `<nav>`, and
  `NavLink` sets `aria-current="page"`.
- Every loading state is announced (`role="status"` + "Loading…"), every
  failure has a message and, for lists, a retry.
- Disabled controls say why in visible text, not only in a `title`
  tooltip that keyboard users never see.
- Tables have a screen-reader caption explaining how rows open.
- Covered by the keyboard E2E journey (open a row with Enter → focus
  stays in the drawer across Tab → Escape returns focus to the row) and
  the primitive tests in `components/admin/adminPrimitives.test.tsx`.

## Tests

- Unit (vitest + MSW): one test file per admin feature
  (`features/admin-*/*.test.tsx`, `features/auth/auth.test.tsx`) plus the
  primitives.
- E2E (Playwright, `frontend/e2e/admin-journeys.spec.ts`), API stubbed
  per test with `page.route` (`e2e/support.ts`), in the CI `e2e` job.
  Covers the `TESTING.md` admin journeys; see the list there.
- "RBAC via direct API call" is a backend test, not E2E: every admin
  viewset's test module asserts 401 for anonymous and 403 for a
  signed-in user without the codename (e.g.
  `apps/users/tests.py::test_requires_auth_then_permission`,
  `apps/audit/tests.py::test_audit_is_strictly_read_only_even_for_superuser`).

## Known gaps

- Assignees (Inbox) are entered as a numeric user id. A picker needs a
  lightweight "assignable staff" endpoint that roles without
  `users.view_user` can call.
- Relational content fields (technology, tags, related services) are
  comma-separated slug/id inputs, not pickers.
- Out of scope for the admin SPA: real-time updates, bulk import/export,
  an audit-log retention job, admin i18n, and a visual page builder.
