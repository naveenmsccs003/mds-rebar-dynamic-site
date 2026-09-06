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
