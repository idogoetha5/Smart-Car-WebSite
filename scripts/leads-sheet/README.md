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
overwritten. Keep row 4 headers and the hidden G key column intact. A row manually
deleted after a successful sync stays deleted because its key remains in the
ledger. Formula-looking customer strings are escaped before writing.

This is an append-only site-to-sheet integration. Editing the sheet does not
modify bookings. A customer making another request creates a separate lead;
multiple requests from one phone are retained intentionally.

Until the trigger has been verified live, keep the existing office CSV cron.
After verification remove only its `vercel.json` cron entry. Per-request office
and customer emails remain enabled. The Tel Aviv customer-form sheet uses its
own script, secrets and outbox and is independent.
