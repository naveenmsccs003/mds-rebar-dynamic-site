# Acceptance

The final acceptance test for Phase 16 (`DEVELOPMENT_PHASES.md` row 16).
Two parts: an **automated suite** that re-asserts the cross-cutting
guarantees on every run, and a **manual checklist** for the items that
need a human or the deployed environment.

## Automated — `backend/tests/test_acceptance.py`
Runs in CI (`backend` and `integration` jobs). Fails the build if any
guarantee regresses.

| Guarantee | Assertion |
|---|---|
| Response envelope (success + error) | shape of `/services/` and a 404 |
| Server-side authorization | admin endpoint → 401 anon, 403 under-permissioned |
| Audit log is append-only | no mutating route exists (403/404/405) |
| Security headers on every response | CSP + Permissions-Policy + `nosniff` |
| Public writes are throttled | 11th `POST /contact/` → 429 |
| Operability endpoints served | `/health/`, `/ready/`, `/robots.txt`, `/sitemap.xml` |
| Global search answers | seeded service is found |
| Private files need authorization | anon download → 403 |

Supported by the full suite: **252 backend** tests (incl.
`test_integration.py`, `test_query_performance.py`,
`test_response_cache.py`, `test_health.py`), **91 frontend**, **4
Playwright E2E** + the deploy `smoke.spec.ts`.

## Manual checklist (pre-launch, against staging)

### Product
- [ ] Every public page renders with real content entered through the
      CMS (no `[CONTENT PLACEHOLDER — ADMIN TO COMPLETE]` left visible).
- [ ] Quote, contact, and job-application forms deliver: acknowledgement
      email to the submitter, internal alert to the configured inbox,
      and a row in the admin.
- [ ] Reference numbers (`MDS-Q-…`, `MDS-E-…`) appear on the
      confirmation and in the acknowledgement email.
- [ ] Résumé / restricted-resource downloads work only through the
      signed-URL path and write a `DownloadLog`.
- [ ] Sitemap lists exactly the published content; `robots.txt`
      disallows `/admin/` and the file paths.
- [ ] Lighthouse on `/`, `/services`, `/portfolio`, `/news`, `/careers`:
      LCP / INP / CLS in "Good".

### Security & RBAC
- [ ] Each of the 10 roles can do exactly what `RBAC_DESIGN.md` says and
      nothing more — checked via the API, not just the (absent) admin UI.
- [ ] `manage.py check --deploy` is clean with the real production env.
- [ ] CSP is enforced (not report-only) and the site loads with no
      violations; TLS + HSTS confirmed by an external scanner.
- [ ] Secrets come only from the environment; `.env` is not in any image
      (`.dockerignore` verified).

### Operations
- [ ] `/ready/` returns 503 (and the LB drops the instance) when the DB
      or cache is down, or a migration is unapplied.
- [ ] `restore_drill.sh` passes against a real production backup file.
- [ ] Backup-failure and restore-drill-failure alerts fire (test by
      forcing a failure).
- [ ] Rollback rehearsed: redeploy the previous SHA image and confirm
      the site is healthy.
- [ ] RPO / RTO / retention numbers in `BACKUP_DISASTER_RECOVERY.md`
      replaced with the chosen provider's actual guarantees.

### Spec §81
The platform's own specification §81 acceptance list is not reproduced in
this repo. Walk it line by line against the above before sign-off; add
any item it names that is not already covered here.
