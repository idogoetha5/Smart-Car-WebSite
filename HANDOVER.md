# SmartCar — handover, 29 July 2026 (updated 30 July 2026, 3 August 2026)

State as of 29 July: `clean-main` @ `9c39667`, local = origin = Production.
Sections 1, 3 and 4 below are unchanged and still accurate. **As of 3 August,
local is ahead of origin/Production — see section 6 for why the push and
deploy are deliberately on hold.**

---

## 1. Assistive technology — what may and may not be claimed

`evidence/a11y/screen-readers-2026-07-29.md` is the gate on this. **No screen
reader may be named in the accessibility statement until its row there is
filled in.**

### Tested

| Screen reader | Browser | OS | Environment |
|---|---|---|---|
| NVDA | Microsoft Edge | Windows 11 | BrowserStack |
| VoiceOver | Safari | macOS | BrowserStack |
| VoiceOver | Safari | macOS | Local, by the owner |

These two — NVDA and VoiceOver — are the only ones named in the published
statement, in both languages. That is correct and should stay that way.

### Not tested — must not be claimed

| Screen reader | Browser | OS | What it needs |
|---|---|---|---|
| **JAWS** | Chrome or Edge | Windows | A licence. The official trial runs in 40-minute sessions. **Named nowhere on the site today — keep it that way.** |
| VoiceOver | Safari | **iOS** | A physical iPhone, or a BrowserStack real-device session |
| NVDA | **Firefox** | Windows | Same BrowserStack setup as the Edge run; only the pairing differs |
| TalkBack | Chrome | Android | A physical Android device, or BrowserStack |

None of these blocks anything that is live. They bound what the statement may
say, nothing more.

### If a session is run, cover at least

Page title and language on entry; navigation by heading, landmark, link and
form control; desktop and mobile menus; switching Hebrew ↔ English; the
catalogue, filtering and vehicle selection; the gallery and vehicle card; the
booking form including dates, add-ons and error messages; the leasing and
contact forms; the FAQ accordion; the cookie banner and dynamic messages; the
accessibility, privacy and terms pages; and full keyboard-only operation
including focus order, focus retention and Escape.

**Do not submit a real booking, lead, email or payment.** Stop before the send
action.

### Automated position, for context

34 public pages, axe and Pa11y, 0 violations and 0 pages that failed to scan;
13 dynamic scenarios including reflow at 320px and the 200%/400% zoom
equivalents, 0 violations. Raw output in `evidence/a11y/2026-07-29/`.

A clean automated scan is evidence, not a conformance statement. axe evaluated
27 rules; WCAG 2.1 AA has 50 success criteria.

---

## 2. Open work

- ~~**Durable email outbox** (audit finding 49)~~ — **implemented**, see the
  3 August addendum below for schedule, retry window and what still needs a
  human. Section kept only as a pointer; do not re-open as "not implemented."
- ~~Honeypot `_website` is not registered with react-hook-form~~ — **fixed
  30 July**, see addendum.

## 3. Owner's, not code

ח.פ. / legal entity name · off-site R2 backups and scheduling · DB password
rotation · per-event EmailJS templates · the TEST booking `c5dd856c…` still
CONFIRMED in Production.

## 4. Settled — do not re-open

- **Coupons.** The booking form's coupon field does not affect the saved
  price. This is deliberate: no real coupon codes exist, `/api/coupons` never
  validates one, and the path is inert. It has been logged as a bug before. It
  is not one.
- **Admin on mobile.** Rebuilt and verified by the owner on his phone.
- **The accessibility statement and cookie policy** are the owner's approved
  wording, published verbatim in both languages. Do not soften, re-word or add
  qualifications.

---

## 5. Addendum, 30 July 2026

Fixed against an external audit, one item at a time, each verified against
current code before touching anything (the audit that prompted this had
stale claims mixed with real ones — see below for what wasn't real).
`clean-main` @ `d861a73`, local = origin = Production, 206 tests, lint 0
errors / 1 warning (same pre-existing `watch()` warning as always).

**Fixed and deployed:**
- Leasing quote numbers could silently overwrite a different customer's
  saved row and PDF on a random six-digit collision (`quote_history.ts`'s
  `archiveQuotePdf` upserts on the DB's `UNIQUE quote_number`).
  `resolveUniqueQuoteNumber` now checks for a real collision — a different
  customer already holding that number — and draws a fresh one; the number
  keeps its rental-quote sibling's short, phone-readable feel.
- `isoToday()`/`todayIL()` computed "today" from UTC, which reads as
  yesterday for the first two—three hours after midnight Israel time — this
  is the bug the owner's screenshot caught live. Both now use `Asia/Jerusalem`
  explicitly.
- The rental quote PDF's vehicle image URL is fetched server-side by a
  headless browser; an admin-typed URL of any host could point that fetch
  anywhere. `safeImageUrl()` now only allows the Supabase storage host
  `next.config.ts` already trusts, plus `data:image` URIs.
- The mobile admin drawer had `role="dialog"` but no focus trap — Tab could
  leave it into the page underneath. Fixed.
- `BookingForm`'s honeypot field had a `name` but was never registered with
  react-hook-form, so a bot filling it never reached the server-side check.
  Read off a ref instead. `ContactForm` never had a honeypot at all even
  though `/api/contact` already checked for one — added it.
- "שלח שוב" (resend quote email) fired immediately on click with no
  confirmation, unlike every other irreversible admin action in this
  codebase. Added the same `confirm()` used everywhere else.
- Privacy policy: English was missing four sections Hebrew has (marketing
  opt-out, international transfers, cookies pointer, complaint-to-authority)
  — translated the already-approved Hebrew content across. Added Resend,
  Google Analytics, Cloudflare and Upstash to the vendor table in both
  languages — all four are live in the code and none were disclosed. Changed
  the breach-notice line from a flat 72 hours (GDPR's figure) to
  "immediately," matching Israel's Protection of Privacy Regulations (Data
  Security), 5777-2017. **This one is a legal-content change, not a pure code
  fix — worth an actual lawyer's eyes before treating as final,** unlike the
  code fixes above.
- Cars-for-sale image and the footer logo (separate report, same day) — see
  git log, not part of the audit above.

**Reviewed and NOT changed, with reasons:**
- `numericOrderReference` (order-reference.ts) uses a deterministic hash, not
  a random draw, and per its own docstring is *never* used as a lookup or
  upsert key — a collision means two customers could quote back the same
  6-digit number at the desk, not a wrong or overwritten record. Real
  tradeoff, already deliberate, not the same bug class as the quote-number
  one above.
- `scripts/audit-critical.mjs` treating npm audit's endpoint being down as a
  pass rather than a CI failure is intentional (see the comment at the top of
  that file) — already the fix for an earlier, different problem, not a gap.
- The accessibility statement's screen-reader claims (NVDA/Edge,
  VoiceOver/Safari) exactly match `evidence/a11y/screen-readers-2026-07-29.md`
  — nothing false is published. The evidence file is a session log (who,
  what, when), not a per-route pass/fail table; producing that would mean
  re-reviewing the actual BrowserStack/local recordings, which nobody has
  done — flagged, not fabricated.
- ~~Durable email outbox — unchanged, still needs the SQL-diff-and-rollback
  conversation from section 2 above before any code gets written.~~ Done in a
  later session (30 July, hardened 3 August) — see the 3 August addendum.

---

## 6. Addendum, 3 August 2026 — seasonal pricing, quote-number dedup, and a hold on deploy

Session scope: admin-configurable seasons/pricing overhaul, quote-number
collision-proofing, email-outbox retry window widened to a week, admin-area
analytics/cookie-banner suppression, a mobile WhatsApp-button overlap fix
(booking form **and** the homepage footer), Israel-timezone fix for the
booking API's past-date check, a real global 404 page, and a short cache on
`/api/pricing-config`. All code-complete and locally verified. **Not pushed
or deployed — see "Deploy is blocked" below before doing either.**

### Durable email outbox — now fully documented, not "not yet implemented"

Lives entirely in `src/app/api/cron/email-retry/route.ts` +
`scripts/add-email-outbox-table.sql` (already applied, from the 30 July
session). Vercel Cron fires it once daily at 03:00 (`vercel.json`) — the
Hobby plan caps cron frequency at once a day, so this is the only schedule
available, not a design choice.

- **Attempt window**: up to `MAX_SWEEP_ATTEMPTS = 5` sweep attempts, and
  separately a hard `MAX_AGE_MS` ceiling of **7 days** from the row's
  `created_at` — either one hitting first ends the row's retries. Previously
  `MAX_AGE_MS` was 24 hours, which killed a message after its very first
  daily sweep; both together now give a genuine multi-day retry window.
- **On success**: `sendTemplateEmail`'s own `resolveRetry()` deletes the row.
  Nothing left to clean up — a delivered email does not linger in the table.
- **On permanent failure** (attempts or age ceiling reached): the row is set
  to `status: 'dead'` and left in place for manual review — it is never
  deleted automatically. Query `select * from email_outbox where status =
  'dead'` in the Supabase SQL Editor to see what needs a human; there is no
  admin-UI view for this yet.
- **Failure-to-update is no longer silent**: if the Supabase update itself
  fails while marking a row dead or rescheduling it, that failure is now
  logged with `console.error` (event + idempotency key + the DB error
  message only — never the recipient email or template payload) so it
  surfaces in Vercel's function logs instead of vanishing.
- **To confirm this is live in Production**: hit the cron route's own log
  output after any 03:00 run (Vercel dashboard → Cron tab → this function's
  invocations), or check `select count(*) from email_outbox` in the SQL
  Editor — a healthy system has this at or near zero most of the time
  (rows only accumulate between a send failure and the next daily sweep).

### Seasonal pricing admin UI — extended, not rebuilt

`/[locale]/admin/(protected)/pricing` now has, in addition to the season
list and single-vehicle override editor that already existed: a season can
carry an optional fleet-wide **fixed price/day** (`pricing_seasons.fixed_price`,
new nullable column) as an alternative to its `adjustment_percent`; a
by-season table of every vehicle with make/model/year/**vehicle number**
(the fleet has many same-model-same-year vehicles, so the plate/unit number
is now shown everywhere a vehicle is named — search results, the table, the
vehicle picker); bulk actions (apply a percent or fixed price to the whole
fleet or only the checked rows, or revert a group to the season default)
each gated behind a confirm dialog stating the exact affected count.
Resolution order, unchanged from the brief and enforced in
`priceForSeason()` (`src/lib/seasonal.ts`): per-vehicle override (fixed or
percent) → season's own fixed price → season's percent → the vehicle's
regular price when no season applies. A season or vehicle with none of the
new fields set behaves exactly as it did before this session — nothing
about `getSeasonalPrice()`'s existing behavior changed, only what feeds it.

**Cross-season pricing math in the vehicle cards and the "החל מ" wording
were deliberately not touched — do not change them under this heading.**

### Quote numbers can no longer overwrite each other

`quote_history.ts` now keys every save on the quote's own UUID (`data.id`,
already the table's primary key) instead of the six-digit `quote_number`.
The six-digit number is display-only from here on — it is expected to repeat
across customers, same email or not, concurrent or not. PDF storage paths
are also keyed by id, never by the display number. See
`scripts/allow-duplicate-quote-numbers.sql` below for the matching DB change.

### Two new migrations — additive, NOT yet run against Production

- `scripts/add-season-fleet-fixed-price.sql` — adds nullable
  `pricing_seasons.fixed_price`. Every existing season row keeps working
  exactly as before (falls through to `adjustment_percent`, same as always).
- `scripts/allow-duplicate-quote-numbers.sql` — drops the `UNIQUE` constraint
  on `quotes.quote_number` (replaced by a plain index for search) now that
  `id` is the real key. Does not touch, move or delete any existing row;
  today's `quote_number` values are already distinct, so this is a no-op
  against current data.

**Both need to be pasted into the Supabase SQL Editor and run by hand before
this branch is pushed to `clean-main` — do not skip this.** Reasoning: the
new code unconditionally selects `pricing_seasons.fixed_price` (via
`SEASON_COLUMNS` in `src/lib/db/pricing.ts`) in `GET /api/pricing-config`,
in the admin pricing routes, and — critically — in the real booking API
(`src/app/api/bookings/route.ts`, which imports `getActiveSeasons` for
server-side price calculation). If that column does not exist yet in
Production, every one of those will 500, including live customer booking
submissions. Likewise, the quote-save code now assumes the old unique
constraint on `quote_number` is gone.

This session could not run either migration directly: there is no Supabase
CLI project link in this repo, no direct Postgres connection string, and
`vercel env pull` returns every Production variable as an empty string for
this project (every var here — including ones with no reason to be
sensitive, like `NEXT_PUBLIC_APP_URL` — is marked "Sensitive" in the Vercel
dashboard, which the CLI cannot decrypt on pull; this is the same trap noted
in the 28 July session). The Supabase service-role key is therefore not
retrievable from this environment, and there is no code-level workaround
that doesn't mean adding a raw-SQL-execution endpoint to the app, which is
not an acceptable thing to leave lying around for a two-line schema change.

**Deploy is blocked on this, by design**: `clean-main`'s Production
environment auto-deploys on push (see the 30 July session), so pushing this
branch before the migrations are applied would ship code that 500s on every
booking and every pricing-config read. Everything in this session is
committed locally only. To finish: run the two SQL files above in the
Supabase SQL Editor (safe, additive, reviewed), then push `clean-main` — CI
and the production deploy can proceed immediately after that, no code changes
needed.

### Everything else, verified without needing Production

- Admin area confirmed (locally, via the real dev server) to render neither
  the cookie banner nor any analytics script, regardless of stored consent —
  `isAdminArea()` gates all four in `src/lib/site-chrome.ts`-consuming
  components. Public-site consent/banner behavior is unchanged.
- The floating WhatsApp button is now hidden on `/rental/[id]` (the booking
  form is tall enough to put it over a field or the submit button on a
  phone) with an inline WhatsApp link added next to that page's booking
  heading as the replacement contact path. Measured directly (headless
  Chromium, real DOM rects, not visual guesswork) at 320/390/430px: it no
  longer overlaps the homepage footer's legal-links row either — that row
  stacks vertically below `sm` and was landing under the fixed button at the
  very bottom of the page; the footer now reserves extra bottom padding on
  mobile only (`pb-28 sm:pb-12`) to clear it.
  The floating accessibility button was also checked against this same
  concern (it sits near the language switcher at desktop widths) — at true
  phone widths it is bottom-left, not near the top nav at all, so there is
  no collision there; not changed.
- `isoToday()` (`src/lib/rental-quote.ts`, already Asia/Jerusalem-aware from
  30 July) is now also used for the booking API's past-pickup-date check —
  previously that one check alone still compared against
  `new Date().toISOString()`, UTC, so a pickup date of "today" could read as
  in the past for the first two-three hours after midnight Israel time.
  Nothing about date selection, pricing or any other date logic changed.
- Global 404: `app/layout.tsx` renders no `<html>`/`<body>` of its own (only
  `app/[locale]/layout.tsx` does, since locale is a top-level dynamic
  segment) — so a genuinely unmatched URL had no layout to supply a document
  shell. Added `app/global-not-found.tsx` (Next's documented fix for exactly
  this shape of app) plus `experimental.globalNotFound: true` in
  `next.config.ts`. Confirmed locally with real HTTP requests, not
  guesswork: paths excluded from next-intl's redirect (e.g. `/images/...`,
  `/icons/...` — see the matcher in `src/proxy.ts`) now return a true `404`
  status with `lang="he" dir="rtl"`, a real `<title>`, a `<main>`, and
  working links to home/fleet/contact. Ordinary garbage paths under a
  locale (e.g. `/he/whatever`) were already fine — they hit
  `app/[locale]/not-found.tsx`, which inherits the locale layout's document
  shell and was not changed.
- `GET /api/pricing-config` now cached 30s via `unstable_cache` (tag
  `pricing-config`, `src/lib/pricing-config-cache.ts`), invalidated with
  `revalidateTag` from every admin route that writes a season or override
  (both `pricing-seasons` routes, both `pricing-overrides` routes, and the
  new bulk route). No price value or calculation changed — this only
  removes a DB round-trip on cache hits and guarantees a saved price is
  live within one request, not up to 30s stale.

### Tests, before push

Full local suite (typecheck, lint, `vitest run`, `next build`,
`git diff --check`) run in this session — see the commit for the exact
result. New dedicated coverage added for: seasonal price resolution (fleet
percent, fleet fixed, per-vehicle fixed, per-vehicle percent, revert to
default, season priority/overlap, and a snapshot that every pre-existing
season/override keeps its old computed price), quote-number collision on a
shared email, two parallel quote creations landing on the same six-digit
number, the email-outbox retry window across simulated days, and the
Israel-midnight booking-date case. Mobile-width and 404 checks above were
run against a real local server with headless Chromium and curl, not unit
tests, since they depend on actual layout and HTTP behavior.

### Still open

Everything carried from the 30 July session (ח.פ., off-site R2 backup,
DB password rotation, DKIM/DMARC) is unchanged. New from this session: the
two migrations above need to be run in the Supabase SQL Editor before this
branch can be pushed and deployed; after that, this section's "Deploy is
blocked" note is stale and can be removed.
