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
#   SUPABASE_SERVICE_ROLE_KEY  service role key       (optional, see below)
#   SUPABASE_DB_URL    postgres connection string     (fallback, see below)
#   STORAGE_BUCKETS    space-separated                (default: vehicles)
#   SENTRY_DSN         optional; failures reported if set
#
# Two ways to find the objects, because the service role key is marked
# Sensitive in Vercel and therefore exports as an empty string:
#
#   1. SUPABASE_SERVICE_ROLE_KEY — lists the bucket via the Storage API. This
#      is authoritative: it sees every object, including any not referenced by
#      a vehicle row.
#   2. SUPABASE_DB_URL — reads the distinct image_urls out of the vehicles
#      table instead. The bucket is public for reads, so the files download
#      without a key. This covers every image the site actually serves, which
#      is what a restore needs, but it would miss an orphaned object.
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
command -v curl >/dev/null || fail "curl not installed"

MODE=""
if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  MODE="api"
elif [ -n "${SUPABASE_DB_URL:-}" ]; then
  command -v psql >/dev/null || fail "psql not installed and no service role key (brew install libpq)"
  MODE="db"
else
  fail "set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_DB_URL"
fi
echo "Object source: ${MODE}"

total=0

if [ "$MODE" = "db" ]; then
  bucket="$(echo "$BUCKETS" | awk '{print $1}')"
  mkdir -p "${WORK}/${bucket}"
  urls="${WORK}/${bucket}.urls"
  psql "$SUPABASE_DB_URL" -tAc \
    "select distinct unnest(image_urls) from vehicles where image_urls is not null order by 1" \
    > "$urls" 2>/dev/null || fail "could not read image_urls from the database"
  sed -i '' '/^$/d' "$urls" 2>/dev/null || sed -i '/^$/d' "$urls"

  n="$(wc -l < "$urls" | tr -d ' ')"
  echo "  ${n} distinct image URL(s) referenced by vehicles"
  [ "$n" -gt 0 ] || fail "the database references no images — refusing to call that a successful backup"

  while IFS= read -r u; do
    [ -z "$u" ] && continue
    rel="${u##*/public/${bucket}/}"
    out="${WORK}/${bucket}/${rel}"
    mkdir -p "$(dirname "$out")"
    curl -sS -f -m 60 "$u" -o "$out" || fail "download failed: ${u}"
    [ -s "$out" ] || fail "downloaded empty file: ${u}"
  done < "$urls"

  got="$(find "${WORK}/${bucket}" -type f | wc -l | tr -d ' ')"
  [ "$got" -eq "$n" ] || fail "expected ${n} files, got ${got}"
  total="$got"
  echo "  ${got} file(s) downloaded and non-empty"
  BUCKETS=""
fi

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

if ! command -v rclone >/dev/null || ! rclone listremotes 2>/dev/null | grep -q "^${RCLONE_REMOTE}:"; then
  KEEP="${BACKUP_DIR:-./backups}/storage-${STAMP}"
  mkdir -p "$(dirname "$KEEP")"
  cp -R "$WORK" "$KEEP"
  echo
  echo "WARNING: no rclone remote '${RCLONE_REMOTE}' — kept locally at ${KEEP}"
  echo "${total} object(s). A copy on the same disk is half a backup."
  exit 0
fi

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
