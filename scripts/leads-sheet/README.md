# SmartCar lead sheet sync

Target: `https://docs.google.com/spreadsheets/d/1Ve0QjN471GdNno0mxfRkHmigozjRoBdoOr84PFNZH04/edit`

The bound Apps Script pulls `/api/integrations/leads` every five minutes. Its
dedicated bearer credential is `LEADS_SHEETS_SYNC_SECRET` in Vercel Production
and `LEADS_SYNC_SECRET` in Script Properties. Never use the database service key,
admin-session secret or cron credential for this feed.

Install the complete `AppsScript.gs` in the sheet's bound project, set the Script
Property, and run `installLeadSync` once. Authorize the current spreadsheet,
external URL fetch and scheduled execution. Verify two successful executions and
the time trigger before calling the integration active. Project:
`https://script.google.com/home/projects/1Fo5m8tU8MGH1s9odmJjixJN0jOZnoaeE7ErxyFfhtRzYXRD_hkRiULpg/edit`.

The feed reconciles all four source tables, with pagination, and fails the whole
response if any source cannot be read. Name filtering lives in `src/lib/lead-export.ts`.
Rows are appended once using `source:id` keys in column G and a hidden
`_smartcar_sync` ledger. Existing customer cells and manual columns are never
overwritten. Keep the headers and the hidden G key column intact. The script
finds the header within the first 20 rows, so removing an introductory row is safe. A row manually
deleted after a successful sync stays deleted because its key remains in the
ledger. The ledger seeds the original import through 2026-10-19 18:23 Israel time,
so owner deletions made before activation also stay deleted. Formula-looking
customer strings are escaped before writing. Last-success time is a note on A1;
it does not replace the owner's title or overwrite a header row.

This is an append-only site-to-sheet integration. Editing the sheet does not
modify bookings. A customer making another request creates a separate lead;
multiple requests from one phone are retained intentionally.

October24 follow-up: new records are inserted as complete rows immediately
below the header, newest first; keys, manual edits, added columns and deletion
ledger remain intact. The first upgraded run sorts the existing complete rows
once by intake date, then sets LEADS_NEWEST_FIRST_V2. Subsequent runs leave
existing ordering alone. Original generated summary text above the header is
updated on every successful sync with actual time and current lead/contact
counts. Owner-written titles are not replaced. Source inspection found regular
successful five-minute executions and today's rentals already present, while
the original visible summary still incorrectly said October19/65requests.

Activated on 2026-10-19: Google permissions granted by the owner, two live runs
succeeded with zero duplicate additions, and one time trigger was verified. The
periodic office CSV cron entry is removed from `vercel.json`; the route remains
available for a deliberate manual fallback. Per-request office and customer
emails remain enabled. The Tel Aviv customer-form sheet uses its own script,
secrets and outbox and is independent.
