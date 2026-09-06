#!/usr/bin/env bash
# Backup/restore drill (docs/BACKUP_DISASTER_RECOVERY.md — "Restore
# procedure is tested periodically, not assumed to work").
#
# Proves the round-trip works end to end:
#   1. pg_dump the source database (a real backup file, or the live DB)
#   2. create a fresh scratch database
#   3. restore the dump into it
#   4. assert Django sees a fully-migrated, queryable schema
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db  scripts/restore_drill.sh
#   DUMP_FILE=/backups/2026-09-06.dump              scripts/restore_drill.sh   # verify an existing backup
#
# Exit non-zero on any failure. Run it on a schedule against the latest
# production backup — a backup you have never restored is not a backup.
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL to the source (or restore target base)}"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

# Parse DATABASE_URL -> PG* env for the psql/pg_dump tools.
proto_removed="${DATABASE_URL#*://}"
creds="${proto_removed%%@*}"
hostpart="${proto_removed#*@}"
export PGUSER="${creds%%:*}"
export PGPASSWORD="${creds#*:}"
hostport="${hostpart%%/*}"
export PGHOST="${hostport%%:*}"
export PGPORT="${hostport#*:}"; [ "$PGPORT" = "$PGHOST" ] && PGPORT=5432
src_db="${hostpart#*/}"; src_db="${src_db%%\?*}"
scratch_db="restore_drill_$$"

dump_file="${DUMP_FILE:-$work_dir/source.dump}"
if [ -z "${DUMP_FILE:-}" ]; then
  echo "==> pg_dump $src_db"
  pg_dump --format=custom --no-owner --no-privileges --file "$dump_file" "$src_db"
fi
echo "==> dump: $(du -h "$dump_file" | cut -f1)"

echo "==> create scratch db $scratch_db"
psql -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $scratch_db;"
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $scratch_db;"
trap 'psql -d postgres -c "DROP DATABASE IF EXISTS $scratch_db;" >/dev/null 2>&1 || true; rm -rf "$work_dir"' EXIT

echo "==> restore"
pg_restore --no-owner --no-privileges --exit-on-error --dbname "$scratch_db" "$dump_file"

echo "==> verify with Django against the restored copy"
restored_url="postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${scratch_db}"
DATABASE_URL="$restored_url" DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.ci}" \
  python manage.py migrate --check
DATABASE_URL="$restored_url" DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings.ci}" \
  python manage.py shell -c "from django.contrib.auth.models import Permission; assert Permission.objects.exists(), 'no rows restored'; print('restored rows visible:', Permission.objects.count(), 'permissions')"

echo "==> restore drill PASSED"
