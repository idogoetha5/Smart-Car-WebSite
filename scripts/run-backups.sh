#!/bin/bash
# Scheduled wrapper for backup-db.sh + backup-storage.sh.
#
# Off-site target is Google Drive, not Cloudflare R2 (R2 needs a paid-plan
# opt-in Ido hasn't done; Google Drive was free and already available). The
# script defaults are still named RCLONE_REMOTE/R2_BUCKET for R2 -- passing a
# Drive remote through those same variables works identically since rclone
# abstracts the backend.
#
# Nothing here is secret. It only points at two local files that must exist
# with mode 600, set up once per machine:
#
#   ~/.smartcar-db-url        postgres connection string (session pooler)
#   ~/.smartcar-backup-pass   GPG passphrase for the DB dump
#
# Meant to be invoked from cron/launchd. Logs to stdout; redirect to a file
# in the crontab entry if you want a persistent log.
#
# Usage: run-backups.sh [db|storage|all]   (default: all)
MODE="${1:-all}"
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_URL_FILE="${HOME}/.smartcar-db-url"
PASS_FILE="${HOME}/.smartcar-backup-pass"

if [[ ! -f "$DB_URL_FILE" ]]; then
  echo "FAIL: $DB_URL_FILE not found — see scripts/run-backups.sh header" >&2
  exit 1
fi

export SUPABASE_DB_URL
SUPABASE_DB_URL="$(cat "$DB_URL_FILE")"
export SUPABASE_URL="https://iovpoxmdsgsstaduggvb.supabase.co"
export BACKUP_PASSPHRASE_FILE="$PASS_FILE"
export RCLONE_REMOTE="gdrive"
export R2_BUCKET="smartcar-backups"
export BACKUP_DIR="${HOME}/.smartcar-backups"

if [[ "$MODE" == "db" || "$MODE" == "all" ]]; then
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) DB backup ==="
  bash "${DIR}/backup-db.sh"
fi

if [[ "$MODE" == "storage" || "$MODE" == "all" ]]; then
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) Storage backup ==="
  bash "${DIR}/backup-storage.sh"
fi

echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) done ==="
