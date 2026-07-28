#!/bin/bash
# Encrypted logical backup of the Supabase Postgres database.
#
# The project is on the Free plan, which has no customer-restorable scheduled
# backups, while the admin UI hard-deletes rows and dangerous/supabase-setup.sql
# begins with DROP TABLE ... CASCADE. Without this there is no recovery point
# for bookings, leads or consent records.
#
# Nothing here is secret. Every credential arrives through the environment:
#
#   SUPABASE_DB_URL        postgres connection string (required)
#   BACKUP_PASSPHRASE_FILE file holding the GPG passphrase (required)
#   BACKUP_DIR             where to write        (default: ./backups)
#   BACKUP_RETENTION_DAYS  prune older than this (default: 30)
#   SENTRY_DSN             optional; failures are reported if set
#
# A backup you have never restored is not a backup. See RESTORE below.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
PLAIN="${BACKUP_DIR}/backup-${STAMP}.sql.gz"
CIPHER="${PLAIN}.gpg"

fail() {
  local msg="$1"
  echo "FAIL: ${msg}" >&2
  # Report to Sentry if a DSN is configured. A silent backup failure is worse
  # than no backup, because it looks like protection that is not there.
  if [ -n "${SENTRY_DSN:-}" ]; then
    local key host proj
    key="$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https://([^@]+)@.*#\1#')"
    host="$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https://[^@]+@([^/]+)/.*#\1#')"
    proj="$(printf '%s' "$SENTRY_DSN" | sed -E 's#.*/([0-9]+)$#\1#')"
    curl -sS -m 10 -X POST "https://${host}/api/${proj}/store/" \
      -H "Content-Type: application/json" \
      -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${key}, sentry_client=backup-db.sh/1.0" \
      -d "{\"level\":\"error\",\"logger\":\"backup-db.sh\",\"message\":$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/'),\"tags\":{\"job\":\"db-backup\"}}" \
      >/dev/null 2>&1 || echo "  (could not report to Sentry)" >&2
  fi
  exit 1
}

: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL (postgres connection string)}"
: "${BACKUP_PASSPHRASE_FILE:?set BACKUP_PASSPHRASE_FILE (path to the GPG passphrase)}"
[ -r "$BACKUP_PASSPHRASE_FILE" ] || fail "passphrase file not readable: $BACKUP_PASSPHRASE_FILE"
command -v pg_dump >/dev/null || fail "pg_dump not installed (brew install libpq)"
command -v gpg     >/dev/null || fail "gpg not installed (brew install gnupg)"

mkdir -p "$BACKUP_DIR"

echo "Dumping database..."
# --no-owner / --no-privileges so the dump restores into any local database
# without needing Supabase's role names to exist.
# --clean --if-exists so a restore replaces objects rather than colliding.
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "$PLAIN" || fail "pg_dump failed"

# Verify BEFORE encrypting. An empty or truncated dump that encrypts cleanly is
# the worst outcome: it looks like a backup and restores to nothing.
[ -s "$PLAIN" ] || fail "dump is empty: $PLAIN"
if ! gzip -cd "$PLAIN" | grep -q "CREATE TABLE"; then
  fail "dump contains no CREATE TABLE — refusing to keep it: $PLAIN"
fi
TABLES="$(gzip -cd "$PLAIN" | grep -c "CREATE TABLE" || true)"
echo "  dump OK — ${TABLES} table(s), $(du -h "$PLAIN" | cut -f1)"

echo "Encrypting..."
gpg --symmetric --cipher-algo AES256 --batch --yes \
    --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
    --output "$CIPHER" "$PLAIN" || fail "gpg encryption failed"
[ -s "$CIPHER" ] || fail "encrypted file is empty: $CIPHER"

# Only remove the plaintext once the ciphertext exists and is non-empty.
rm -f "$PLAIN"
echo "  encrypted -> ${CIPHER} ($(du -h "$CIPHER" | cut -f1))"

# Optional off-site copy. Left as an explicit command rather than a hardcoded
# provider so the destination is the operator's choice, not this script's.
if [ -n "${BACKUP_UPLOAD_CMD:-}" ]; then
  echo "Uploading..."
  BACKUP_FILE="$CIPHER" sh -c "$BACKUP_UPLOAD_CMD" || fail "upload failed"
  echo "  uploaded"
else
  echo "  (no BACKUP_UPLOAD_CMD set — backup is LOCAL ONLY)"
  echo "  A backup on the same disk as the thing it protects is half a backup."
fi

echo "Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name 'backup-*.sql.gz.gpg' -type f -mtime "+${RETENTION_DAYS}" -print -delete

echo
echo "Done: $CIPHER"
cat <<'RESTORE'

RESTORE (do this at least once — an untested backup is not a backup):

  gpg --decrypt --batch --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
      backup-XXXX.sql.gz.gpg | gunzip > restore.sql
  createdb smartcar_restore_test
  psql smartcar_restore_test < restore.sql
  psql smartcar_restore_test -c "SELECT count(*) FROM bookings;"

Restore into a scratch database. Never into Production.
RESTORE
