# dangerous/

Scripts here destroy production data if run. They are kept for history and for
bootstrapping an empty database — never for fixing a live one.

Both carry an in-file guard that aborts on execution, but the guard is the
second line of defence. The first is that these files no longer sit in the
repository root where they read like ordinary setup steps.

## supabase-setup.sql

Begins with `DROP TABLE ... CASCADE` on `vehicles`, `bookings`,
`leasing_requests` and `seo_redirects`. Running it against Production erases
every booking, lead and consent record.

Guard: aborts unless you first run, in the same session,

```sql
SET smartcar.i_understand_this_deletes_data = 'yes';
```

Intended only for a fresh, empty database. To repair RLS on a live database
use `scripts/hotfix-rls.sql`, which is idempotent and touches no data.

## update-images.sql

Overwrites `image_urls` for the whole fleet with 226 `/images/vehicles/*.png`
paths. Those files were deleted in 87d004c and now 404, so running this blanks
every vehicle image on the site.

Guard: opens with a `DO` block that raises unconditionally.

Use the Node equivalents in `scripts/` instead — they verify every URL returns
200 before writing, and require `ALLOW_ASSET_WRITE=1`.

## Before running anything here

Take a verified backup first: `scripts/backup-db.sh`. A backup you have never
restored is not a backup.
