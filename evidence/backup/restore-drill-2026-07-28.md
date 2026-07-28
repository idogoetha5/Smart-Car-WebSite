# Finding 79 (P0) — backup and restore drill

2026-07-28. Production database, Supabase Free plan (no customer-restorable
scheduled backups).

## Backup

`scripts/backup-db.sh` against the session pooler
`aws-1-eu-west-2.pooler.supabase.com:5432`.

- 47 tables, 128K gzipped
- AES256 via gpg, 100K ciphertext
- passphrase in `~/.smartcar-backup-pass` (mode 600), never in the repo

## Restore drill

The part that actually proves anything. Decrypted the ciphertext, restored it
into a throwaway PostgreSQL 17 cluster on port 55432, and compared row counts
against live Production.

| table | restored | production |
|---|---|---|
| bookings | 47 | 47 |
| vehicles | 171 | 171 |
| leasing_requests | 4 | 4 |
| reviews | 5 | 5 |

Also restored: cars_for_sale 1, email_deliveries 1, condition_reports 0,
contact_leads 0, newsletter_subscribers 0, seo_redirects 0.

Three restore errors, all `supabase_vault` — a Supabase-specific extension that
does not exist in vanilla Postgres. No business table is affected. A restore
onto Supabase itself would not hit this.

The scratch cluster was destroyed afterwards; it held real customer data.

## Two bugs found by doing this rather than assuming

1. `pg_dump` was piped into `gzip`, so its stderr went nowhere and failures
   surfaced as a bare "pg_dump failed". The real cause — a rejected password —
   was invisible. Now captured and printed.
2. `grep -q "CREATE TABLE"` exits on first match, `gzip` takes SIGPIPE, and
   under `set -o pipefail` the pipeline reports failure. A dump containing 47
   tables was therefore rejected as empty and deleted, every time. Only bites
   on files large enough that gzip is still writing. Now `grep -c`.

The second one is worth remembering: the check exists so a bad dump is never
mistaken for a good one, and it did the exact opposite.

## Still open

- **Off-site copy.** This backup is on the same machine as everything else.
  `scripts/backup-db.sh` uploads to Cloudflare R2 once an rclone remote named
  `r2` exists; until then it prints a warning and keeps the file locally.
- **Storage buckets.** `scripts/backup-storage.sh` covers them and has not been
  run — pg_dump does not include Storage, so the 678 vehicle images are not yet
  backed up.
- **Scheduling.** Runs are manual so far.
- **Credential rotation.** The database password was exposed in plaintext
  during this session and must be reset again.
