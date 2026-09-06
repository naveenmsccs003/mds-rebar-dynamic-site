# Backup & Disaster Recovery

## Database
Automated daily PostgreSQL backups plus continuous WAL archiving for
point-in-time recovery, retained per a defined retention window (e.g. 30
daily + 12 monthly — finalized against the actual hosting provider's
capabilities in Phase 16). Restore procedure is tested periodically, not
assumed to work.

## Object storage
Versioning enabled on the storage bucket(s) so an accidental overwrite/
delete is recoverable; cross-region replication considered for
production once a provider is chosen.

## Targets
- **RPO (Recovery Point Objective):** target ≤ 24h via daily backups, or
  down to minutes if WAL/PITR is enabled — stated honestly based on what
  the chosen infrastructure actually guarantees, never "zero data loss"
  without infrastructure that proves it.
- **RTO (Recovery Time Objective):** defined once the hosting/deployment
  platform for staging/production is chosen (Phase 16); documented here
  when known rather than guessed now.

## Monitoring
Backup jobs are monitored and alert on failure — a silent failed backup
is treated as equivalent to having no backup.

---

## Implemented (Phase 16)

### Restore drill — proves the round-trip
`backend/scripts/restore_drill.sh`: `pg_dump` the source (a real backup
file via `DUMP_FILE=…`, or the live DB) → create a fresh scratch
database → `pg_restore` → assert Django sees a fully-migrated
(`migrate --check`) and queryable schema, then drop the scratch DB.
Exits non-zero on any failure.

- **In CI** — the `backup-drill` job (`.github/workflows/ci.yml`,
  `needs: [integration]`) seeds a schema on a Postgres service container
  and runs the drill on every push/PR, so the dump→restore mechanism
  can never silently rot.
- **In production** — schedule it (cron / a k8s CronJob) against the
  **latest real backup file**, alerting on non-zero exit. A backup you
  have never restored is not a backup.

### Recommended concrete targets
Adopt these unless the chosen provider forces otherwise, and record the
final numbers here:

| | Recommended | Requires |
|---|---|---|
| **RPO** | ≤ 5 min | WAL archiving / PITR enabled on the managed Postgres |
| **RTO** | ≤ 1 h | latest base backup + WAL restorable in one run; images already in GHCR; deploy is `migrate` + image promote |
| **DB retention** | 7 daily PITR windows + 30 daily logical dumps + 12 monthly | managed-Postgres automated backups + a dump-to-object-storage job |
| **Object storage** | bucket versioning on + 30-day noncurrent-version retention; lifecycle to cold storage after 90 days | S3 (or equivalent) versioning + lifecycle rules |
| **Backup monitoring** | alert if no successful backup in 26 h, and if the weekly restore drill fails | the provider's backup events + the scheduled `restore_drill.sh` |

### Rollback (unchanged, restated)
Previous release image is kept in GHCR (tagged by commit SHA); rollback
is a redeploy of that image. A migration that has to be undone is
reviewed for safety and split into safe multi-step migrations —
destructive single-step migrations are not written.
