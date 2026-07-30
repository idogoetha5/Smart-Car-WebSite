# SmartCar — handover, 29 July 2026 (updated 30 July 2026)

State at the end of the 29 July session. `clean-main` @ `9c39667`, local =
origin = Production. Lint budget 0 errors / 1 warning, 132 tests, CI green.
Sections 1, 3 and 4 below are unchanged and still accurate — see the addendum
at the bottom for what changed on 30 July.

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

- **Durable email outbox** (audit finding 49). Delivery is retried 3× in-request
  and nothing retries later. Needs a new Supabase table, so per the audit's own
  rules it wants a minimal SQL diff and a rollback plan presented *before*
  anything is applied. Still open as of 30 July — not implemented.
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
- Durable email outbox — unchanged, still needs the SQL-diff-and-rollback
  conversation from section 2 above before any code gets written.
