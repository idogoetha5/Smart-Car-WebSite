#!/bin/bash
# Backs up Supabase Storage buckets (the vehicle images) to Cloudflare R2.
#
# pg_dump does NOT cover Storage. A database backup restores the rows that
# reference an image; it does not restore the image. Losing the `vehicles`
# bucket would leave 678 image URLs pointing at nothing, and no amount of
# database restore would bring them back. This is the other half of the
# backup, not an optional extra.
#
# R2 is a good fit here: rclone speaks it natively and there are no egress
# fees, so a full restore does not cost anything to pull back.
#
# Environment (nothing secret lives in this file):
#
#   RCLONE_REMOTE      configured rclone remote name  (default: r2)
#   R2_BUCKET          destination bucket             (default: smartcar-backups)
#   SUPABASE_URL       project URL                    (required)
#   SUPABASE_SERVICE_ROLE_KEY  service role key       (required)
#   STORAGE_BUCKETS    space-separated                (default: vehicles)
#   SENTRY_DSN         optional; failures reported if set
#
# One-time rclone setup:
#   rclone config create r2 s3 provider=Cloudflare \
#     access_key_id=<id> secret_access_key=<secret> \
#     endpoint=<account>.r2.cloudflarestorage.com
set -euo pipefail

RCLONE_REMOTE="${RCLONE_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:-smartcar-backups}"
BUCKETS="${STORAGE_BUCKETS:-vehicles}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() {
  local msg="$1"
  echo "FAIL: ${msg}" >&2
  if [ -n "${SENTRY_DSN:-}" ]; then
    local key host proj
    key="$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https://([^@]+)@.*#\1#')"
    host="$(printf '%s' "$SENTRY_DSN" | sed -E 's#^https://[^@]+@([^/]+)/.*#\1#')"
    proj="$(printf '%s' "$SENTRY_DSN" | sed -E 's#.*/([0-9]+)$#\1#')"
    curl -sS -m 10 -X POST "https://${host}/api/${proj}/store/" \
      -H "Content-Type: application/json" \
      -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${key}, sentry_client=backup-storage.sh/1.0" \
      -d "{\"level\":\"error\",\"logger\":\"backup-storage.sh\",\"message\":$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/^/"/; s/$/"/'),\"tags\":{\"job\":\"storage-backup\"}}" \
      >/dev/null 2>&1 || true
  fi
  exit 1
}

: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
command -v rclone >/dev/null || fail "rclone not installed (brew install rclone)"
command -v curl   >/dev/null || fail "curl not installed"

total=0
for bucket in $BUCKETS; do
  echo "Listing bucket: ${bucket}"
  mkdir -p "${WORK}/${bucket}"

  # Page through the bucket listing; Supabase caps a single response.
  offset=0
  names="${WORK}/${bucket}.names"
  : > "$names"
  while :; do
    body="$(curl -sS -X POST "${SUPABASE_URL}/storage/v1/object/list/${bucket}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "{\"prefix\":\"\",\"limit\":100,\"offset\":${offset}}")" || fail "list failed for ${bucket}"

    count="$(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);process.stdout.write(String(Array.isArray(a)?a.length:0))}catch{process.stdout.write("0")}})')"
    [ "$count" = "0" ] && break

    printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{JSON.parse(s).forEach(o=>{if(o&&o.name)console.log(o.name)})})' >> "$names"
    offset=$((offset + count))
    [ "$count" -lt 100 ] && break
  done

  n="$(wc -l < "$names" | tr -d ' ')"
  echo "  ${n} object(s)"
  [ "$n" -gt 0 ] || fail "bucket ${bucket} listed 0 objects — refusing to treat an empty listing as a successful backup"

  echo "Downloading..."
  while IFS= read -r obj; do
    [ -z "$obj" ] && continue
    out="${WORK}/${bucket}/${obj}"
    mkdir -p "$(dirname "$out")"
    curl -sS -f "${SUPABASE_URL}/storage/v1/object/${bucket}/${obj}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -o "$out" || fail "download failed: ${bucket}/${obj}"
    [ -s "$out" ] || fail "downloaded empty file: ${bucket}/${obj}"
  done < "$names"

  got="$(find "${WORK}/${bucket}" -type f | wc -l | tr -d ' ')"
  [ "$got" -eq "$n" ] || fail "expected ${n} files, got ${got} for ${bucket}"
  total=$((total + got))
  echo "  ${got} file(s) downloaded and non-empty"
done

echo "Uploading to ${RCLONE_REMOTE}:${R2_BUCKET}/storage/${STAMP}/ ..."
rclone copy "$WORK" "${RCLONE_REMOTE}:${R2_BUCKET}/storage/${STAMP}/" \
  --transfers 8 --checksum --stats-one-line || fail "rclone upload failed"

# Confirm the remote actually holds what we sent, rather than trusting exit 0.
remote_n="$(rclone size "${RCLONE_REMOTE}:${R2_BUCKET}/storage/${STAMP}/" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).count))}catch{process.stdout.write("0")}})')"
[ "$remote_n" = "$total" ] || fail "remote holds ${remote_n} objects, expected ${total}"

echo
echo "Done: ${total} object(s) at ${RCLONE_REMOTE}:${R2_BUCKET}/storage/${STAMP}/"
echo
echo "RESTORE:  rclone copy ${RCLONE_REMOTE}:${R2_BUCKET}/storage/<stamp>/<bucket> ./restore"
echo "          then re-upload with the Supabase CLI or the Storage API."
