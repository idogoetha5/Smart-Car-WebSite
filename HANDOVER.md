# SmartCar — handover, 29 July 2026

State at the end of the session. `clean-main` @ `9c39667`, local = origin =
Production. Lint budget 0 errors / 1 warning, 132 tests, CI green.

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
  anything is applied.
- **Honeypot** `_website` is not registered with react-hook-form, so the real
  form never sends it. The server-side check still catches a naive direct
  poster, so this is cosmetic rather than a hole.

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
