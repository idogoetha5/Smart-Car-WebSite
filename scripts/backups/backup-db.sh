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
#   RCLONE_REMOTE          rclone remote for off-site copy (default: r2)
#   R2_BUCKET              destination bucket (default: smartcar-backups)
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
#
# pg_dump's stderr is captured rather than inherited: piping into gzip meant a
# connection or auth failure printed nothing useful and the caller saw only
# "pg_dump failed". The reason is the whole point of an error.
DUMP_ERR="$(mktemp)"
if ! pg_dump "$SUPABASE_DB_URL" \
       --no-owner --no-privileges --clean --if-exists 2>"$DUMP_ERR" \
     | gzip -9 > "$PLAIN"; then
  echo "--- pg_dump said: ---" >&2
  sed 's/^/  /' "$DUMP_ERR" >&2
  # Never leave a partial dump behind; it is indistinguishable from a real one
  # at a glance and would be pruned on age like a good backup.
  rm -f "$PLAIN" "$DUMP_ERR"
  fail "pg_dump failed"
fi
rm -f "$DUMP_ERR"

# Verify BEFORE encrypting. An empty or truncated dump that encrypts cleanly is
# the worst outcome: it looks like a backup and restores to nothing.
if [ ! -s "$PLAIN" ]; then rm -f "$PLAIN"; fail "dump is empty"; fi
# grep -c, not grep -q. -q exits on the first match, gzip takes SIGPIPE, and
# under `set -o pipefail` the pipeline then reports failure — so a perfectly
# good dump with 47 tables was being rejected as empty. Only shows up once the
# file is large enough that gzip is still writing when grep bails.
TABLES="$(gzip -cd "$PLAIN" | grep -c "CREATE TABLE" || true)"
if [ "${TABLES:-0}" -eq 0 ]; then
  rm -f "$PLAIN"
  fail "dump contains no CREATE TABLE — refusing to keep it"
fi
echo "  dump OK — ${TABLES} table(s), $(du -h "$PLAIN" | cut -f1)"

echo "Encrypting..."
gpg --symmetric --cipher-algo AES256 --batch --yes \
    --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
    --output "$CIPHER" "$PLAIN" || fail "gpg encryption failed"
[ -s "$CIPHER" ] || fail "encrypted file is empty: $CIPHER"

# Only remove the plaintext once the ciphertext exists and is non-empty.
rm -f "$PLAIN"
echo "  encrypted -> ${CIPHER} ($(du -h "$CIPHER" | cut -f1))"

# Off-site copy to Cloudflare R2. A backup on the same disk as the thing it
# protects is half a backup. R2 has no egress fees, so a full restore costs
# nothing to pull back.
#
# One-time setup:
#   rclone config create r2 s3 provider=Cloudflare \
#     access_key_id=<id> secret_access_key=<secret> \
#     endpoint=<account>.r2.cloudflarestorage.com
if command -v rclone >/dev/null && rclone listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE:-r2}:"; then
  REMOTE="${RCLONE_REMOTE:-r2}"; BUCKET="${R2_BUCKET:-smartcar-backups}"
  echo "Uploading to ${REMOTE}:${BUCKET}/db/ ..."
  rclone copy "$CIPHER" "${REMOTE}:${BUCKET}/db/" --checksum --stats-one-line \
    || fail "rclone upload failed"
  # Verify the remote really has it rather than trusting exit 0.
  rclone lsf "${REMOTE}:${BUCKET}/db/$(basename "$CIPHER")" >/dev/null 2>&1 \
    || fail "upload reported success but the object is not on the remote"
  echo "  uploaded and confirmed on ${REMOTE}"
elif [ -n "${BACKUP_UPLOAD_CMD:-}" ]; then
  echo "Uploading via BACKUP_UPLOAD_CMD..."
  BACKUP_FILE="$CIPHER" sh -c "$BACKUP_UPLOAD_CMD" || fail "upload failed"
  echo "  uploaded"
else
  echo "  WARNING: no rclone remote and no BACKUP_UPLOAD_CMD — backup is LOCAL ONLY."
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
