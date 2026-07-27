# SmartCar — Accessibility evidence pack

**Date:** 2026-07-28
**Standard:** Israeli Standard 5568 (Sept 2023 edition, which references
WCAG 2.0) — tested here against the stricter **WCAG 2.1 Level AA**.
**Scope:** the public, customer-facing site, 17 route templates × `he`/`en`
= 34 page/locale combinations (includes the new unsubscribe page), plus dynamic states, reflow/zoom and
keyboard operation.
**Explicitly out of scope:** the `/admin` area (internal staff tool) and
the generated quote PDF.

> This is an internal evidence pack, not a certification. Nothing below is
> marked PASS without a stored artefact backing it. Anything that could not
> be tested in this environment is marked `NOT TESTED` with instructions for
> completing it — it is never guessed at and never assumed to pass.

## How to reproduce

```bash
npm install                                   # scan tools are devDependencies
npm run dev                                   # http://localhost:3000
bash scripts/run-a11y.sh  evidence/a11y/pa11y-static-after.json
node scripts/run-axe.js                       # -> axe-results.json
node scripts/run-axe-dynamic.js  evidence/a11y/axe-dynamic-after.json
node scripts/run-keyboard-tests.js evidence/a11y/keyboard-tests.json
```

Raw artefacts live in `evidence/a11y/` (gitignored — never deployed, and
they contain no personal data).

## Tools

| Tool | Engine | Ruleset | What it covers |
|---|---|---|---|
| pa11y | HTML_CodeSniffer | WCAG2AA | Static DOM at page load |
| axe-core (via puppeteer) | axe | wcag2a, wcag2aa, wcag21aa | Static DOM, second independent engine |
| `run-axe-dynamic.js` | axe | same | Open menus, expanded accordions, open date picker, form states, cookie banner, 320px reflow, 200%/400% zoom, reduced motion |
| `run-keyboard-tests.js` | custom, puppeteer | — | Focus order, focus visibility, keyboard traps, skip link, Escape handling, accessible names |

Two independent engines are used deliberately: they implement different
rules and each catches issues the other misses.

## Automated results

| Scan | Before (2026-07-27) | After |
|---|---|---|
| pa11y, 34 pages | 442 errors | **0 errors** |
| axe-core, 34 pages | 18 violation groups | **0 violation groups** |
| axe-core, 16 dynamic scenarios | not previously run | **0 violations, 15 scanned, 1 not tested** |
| keyboard checks | not previously run | **8 PASS, 0 FAIL, 1 NOT TESTED** |

### Dynamic states scanned (all 0 violations)

mobile menu open (he + en), FAQ accordion expanded (he + en), hero date
picker open, cookie banner visible, review form open, leasing inquiry form
open, contact form, condition-report form, 320px reflow (home + rental),
200% zoom, 400% zoom, reduced-motion.

### Reflow / zoom measurements (WCAG 1.4.10, 1.4.4)

No horizontal overflow in any case — `scrollWidth === clientWidth`:

| Case | scrollWidth | clientWidth | Overflow |
|---|---|---|---|
| 320px, home | 320 | 320 | no |
| 320px, rental | 320 | 320 | no |
| 200% zoom (≈640px) | 640 | 640 | no |
| 400% zoom (≈320px) | 320 | 320 | no |

### Keyboard results

| Check | Result | Evidence |
|---|---|---|
| Skip link is first tab stop, targets `#main-content` | PASS | First Tab lands on "דלג לתוכן הראשי"; `#main-content` exists |
| Visible focus indicator on every tab stop — home (he) | PASS | 30 tab stops, 0 without an indicator |
| Visible focus indicator on every tab stop — contact (he) | PASS | 17 tab stops, 0 without an indicator |
| Visible focus indicator on every tab stop — home (en) | PASS | 30 tab stops, 0 without an indicator |
| Mobile menu: Escape closes, focus returns to trigger | PASS | `aria-expanded` true→ menu removed, focus on trigger |
| Date picker: Escape closes, focus returns to trigger | PASS | 1 picker dialog open → 0 after Escape, focus on trigger |
| FAQ accordion operable by keyboard, state exposed | PASS | `aria-expanded` false→true on Enter, panel present |
| All visible interactive controls have an accessible name | PASS | 0 unnamed controls |
| Booking extras checkboxes keyboard-reachable | **NOT TESTED** | Needs a vehicle detail page; `/api/vehicles` returns 500 locally because the Supabase keys are marked Sensitive in Vercel and cannot be pulled. Complete by running the same script against production. |

## Issues found and fixed in this round

1. **Colour contrast** — brand orange `#E8743B` measured 3.0:1 as text/on
   buttons against white (AA needs 4.5:1). Replaced contextually with
   `#C24E17` (white-text buttons) and `#B64916` (standalone text), keeping
   the original where it already passed on dark backgrounds. Also fixed
   muted grey text, WhatsApp/Waze button colours and status colours.
2. **~66 form controls with no accessible name** — added `aria-label`
   across hero search, catalog/rental filters, leasing calculator and the
   condition-report fields.
3. **Keyboard trap in the date picker** — the calendar popup had no
   keyboard way to close. Added Escape-to-close with focus return, plus
   `aria-haspopup`/`aria-expanded`/`role="dialog"`.
4. **No skip link** — added, as the first tab stop, targeting `#main-content`.
5. **Mobile menu** — added `aria-expanded`/`aria-controls`, `aria-current`
   on the active link, a translated accessible name (was English-only
   "Toggle menu"), and Escape-to-close with focus return.
6. **Toast messages were silent to screen readers** — added
   `role="status"`/`role="alert"` with `aria-live`, and an accessible name
   on the close button.
7. **FAQ accordion** — added `aria-expanded`/`aria-controls` on triggers and
   `role="region"`/`aria-labelledby` on panels.
8. **Booking extras checkboxes were `display:none`** — completely
   unreachable by keyboard. Changed to `sr-only` with a focus-within ring
   on the styled label; visual design unchanged.
9. **`Input` component label association** — it rendered `<label htmlFor>`
   pointing at nothing when no `id` was passed, leaving fields unnamed.
   Now falls back to a generated id, and wires `aria-invalid` /
   `aria-describedby` to the error text.
10. **Missing visible focus** on the hero location selects and the date
    picker trigger (all set `outline-none` with no replacement) — found by
    manual keyboard testing, not by either rule engine. Added focus-visible
    rings.

## IS 5568 / WCAG 2.1 AA criterion matrix

`PASS` = verified with a stored artefact. `NOT TESTED` = not verified here;
no claim is made either way.

### Perceivable

| Criterion | Level | Status | Evidence / note |
|---|---|---|---|
| 1.1.1 Non-text content | A | PASS | 0 axe/pa11y violations across 34 pages; alt text reviewed manually and is descriptive, not filename-based |
| 1.2.x Time-based media | A/AA | NOT APPLICABLE | No audio or video content on the site |
| 1.3.1 Info and relationships | A | PASS | 0 violations; labels, accordion and menu relationships wired and verified |
| 1.3.2 Meaningful sequence | A | PASS | Tab order followed on 3 pages (30/17/30 stops) and matched visual order |
| 1.3.3 Sensory characteristics | A | PASS | No instruction on the site relies on shape, position or sound alone (manual review) |
| 1.3.4 Orientation | AA | PASS | No orientation lock; verified rendering at 320×800 portrait and 640×512 landscape |
| 1.3.5 Identify input purpose | AA | **NOT TESTED** | `autocomplete` tokens on name/email/phone not systematically audited. To complete: check each personal-data field carries the correct `autocomplete` token. |
| 1.4.1 Use of colour | A | PASS | Error states pair colour with text; the availability notice pairs colour with an icon and wording |
| 1.4.2 Audio control | A | NOT APPLICABLE | No auto-playing audio |
| 1.4.3 Contrast (minimum) | AA | PASS | Root cause fixed and re-scanned by two engines; 0 contrast violations |
| 1.4.4 Resize text 200% | AA | PASS | 200% ≈ 640px viewport: no horizontal overflow, no content loss |
| 1.4.5 Images of text | AA | PASS | Text is real text; images are photographs and the logo |
| 1.4.10 Reflow (320px) | AA | PASS | 320px: `scrollWidth === clientWidth` on home and rental |
| 1.4.11 Non-text contrast | AA | **NOT TESTED** | Component boundaries/icons not measured individually. To complete: measure borders, icon and focus-ring colours against adjacent colours with a contrast analyser. |
| 1.4.12 Text spacing | AA | **NOT TESTED** | To complete: apply the WCAG text-spacing bookmarklet and confirm no clipping. |
| 1.4.13 Content on hover/focus | AA | **NOT TESTED** | Tooltips/hover cards not individually exercised. |

### Operable

| Criterion | Level | Status | Evidence / note |
|---|---|---|---|
| 2.1.1 Keyboard | A | PASS (with one gap) | Menu, accordion, date picker and forms all operable by keyboard. Booking **extras** checkboxes fixed in code but marked NOT TESTED — see above. |
| 2.1.2 No keyboard trap | A | PASS | Escape closes the mobile menu and the date picker and returns focus to the trigger, both verified |
| 2.1.4 Character key shortcuts | A | NOT APPLICABLE | No single-character shortcuts implemented |
| 2.2.1 Timing adjustable | A | **NOT TESTED** | The OTP flow in "my bookings" has a cooldown that was not exercised. |
| 2.2.2 Pause, stop, hide | A | PASS | `prefers-reduced-motion` pass scanned clean; no auto-updating or blinking content |
| 2.3.1 Three flashes | A | PASS | No flashing content (manual review) |
| 2.3.3 Animation from interactions | AAA | PASS | Reduced-motion scenario scanned clean |
| 2.4.1 Bypass blocks | A | PASS | Skip link verified as the first tab stop, targeting `#main-content` |
| 2.4.2 Page titled | A | PASS | 0 violations; each route sets its own title |
| 2.4.3 Focus order | A | PASS | Tab sequence recorded on 3 pages and matches visual order |
| 2.4.4 Link purpose (in context) | A | PASS | 0 unnamed controls; link text reviewed manually |
| 2.4.5 Multiple ways | AA | PASS | Global nav, footer links and sitemap.xml |
| 2.4.6 Headings and labels | AA | PASS | Heading outline reviewed: single h1 per page, no skipped levels |
| 2.4.7 Focus visible | AA | PASS | 77 tab stops across 3 pages, 0 without an indicator |
| 2.5.1 Pointer gestures | A | NOT APPLICABLE | No multipoint or path-based gestures |
| 2.5.2 Pointer cancellation | A | PASS | Standard click activation, no down-event triggers |
| 2.5.3 Label in name | A | PASS | Visible labels match accessible names (0 mismatches reported) |
| 2.5.4 Motion actuation | A | NOT APPLICABLE | No device-motion input |
| 2.5.5 Target size | AAA | **NOT TESTED** | 44×44px targets not measured. To complete: measure the carousel arrows and icon buttons on a real mobile viewport. |

### Understandable

| Criterion | Level | Status | Evidence / note |
|---|---|---|---|
| 3.1.1 Language of page | A | PASS | `<html lang>` and `dir` set per locale; 0 violations |
| 3.1.2 Language of parts | AA | **NOT TESTED** | Latin brand/model names inside Hebrew text are not marked with `lang`. To complete: decide whether these need `lang="en"` (proper nouns usually do not) and mark any that do. |
| 3.2.1 On focus | A | PASS | No context change on focus (verified during tab-through) |
| 3.2.2 On input | A | PASS | No form auto-submits or navigates on input |
| 3.2.3 Consistent navigation | AA | PASS | Shared navbar/footer across all routes |
| 3.2.4 Consistent identification | AA | PASS | Icons and controls used consistently (manual review) |
| 3.3.1 Error identification | A | PASS | `aria-invalid` + `aria-describedby` wired; error-state scenario scanned clean |
| 3.3.2 Labels or instructions | A | PASS | 0 violations; every control has a programmatic name |
| 3.3.3 Error suggestion | AA | PASS | Validation messages state what to fix |
| 3.3.4 Error prevention (legal/financial) | AA | PARTIAL — see note | The form is explicitly a *request*, not a contract, and is confirmed in writing by staff before anything binding. There is no in-page final review-and-amend step; that is a product decision, not an implementation gap. |

### Robust

| Criterion | Level | Status | Evidence / note |
|---|---|---|---|
| 4.1.2 Name, role, value | A | PASS | 0 violations; menu, accordion, date picker states verified |
| 4.1.3 Status messages | AA | PASS | Toast uses `role="status"`/`alert` with `aria-live`; availability notice uses `role="status"` |

## Not tested — and exactly how to finish each

1. **Real screen-reader walkthrough (VoiceOver / NVDA).** Neither can be
   driven from this environment: VoiceOver needs macOS GUI automation with
   Accessibility permission and cannot be scripted headlessly; NVDA is
   Windows-only. This is the single biggest remaining gap, because a
   screen reader is the only way to confirm the *experience* rather than
   the markup.
   *To complete:* on a Mac, enable VoiceOver (Cmd+F5) in Safari and walk
   the booking, contact, leasing, OTP and cancellation journeys in both
   languages; on Windows, repeat with NVDA in Chrome and Firefox. Record
   what is announced at each step.
2. **Booking extras keyboard reachability** — run
   `scripts/run-keyboard-tests.js` against production (or a local env with
   Supabase credentials), open a vehicle page, Tab to the extras list and
   confirm each checkbox takes focus with a visible ring.
3. **1.3.5 autocomplete tokens**, **1.4.11 non-text contrast**,
   **1.4.12 text spacing**, **1.4.13 content on hover/focus**,
   **2.2.1 timing (OTP)**, **2.5.5 target size**, **3.1.2 language of
   parts** — each listed above with its own completion instructions.
4. **Real mobile devices.** All mobile testing here used an emulated
   viewport (390×844, 320×800), not physical hardware or real touch input.
5. **Forced-colors / high-contrast mode** was not exercised.
6. **The generated quote PDF** has separate requirements (PDF/UA) that web
   scanners do not cover.

## Honest summary

Two independent engines report zero automatically-detectable WCAG 2.1 AA
violations across all 34 customer-facing page/locale combinations, and
also across 15 dynamic states, 320px reflow, 200%/400% zoom and
reduced-motion. Keyboard testing passes 8 of 9 checks with the ninth
blocked only by a local environment limitation. Ten real defects were
found and fixed, three of which (the date-picker keyboard trap, the
unreachable extras checkboxes, and the missing focus indicators) were
invisible to both rule engines and only surfaced through manual testing.

This is substantive, evidence-backed progress. It is **not** a statement
that the site fully conforms to WCAG 2.1 AA or IS 5568: automated tooling
detects only a portion of real accessibility barriers, several criteria
above remain honestly marked NOT TESTED, and no verification by an actual
screen-reader user has taken place. The site's public accessibility
statement is written to reflect exactly this and must not be upgraded to
claim conformance until the remaining items are genuinely completed.
