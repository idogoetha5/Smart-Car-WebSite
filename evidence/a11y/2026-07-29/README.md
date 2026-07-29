# Accessibility testing — 29 July 2026

Testing carried out against the live site, <https://www.smartcar.co.il>.
The `/tmp` originals were volatile, so the outputs are held here.

## What was run

| # | Test | Scope | Result | File |
|---|---|---|---|---|
| 1 | axe-core | 34 public pages, he + en | 34 scanned, 0 failed to load, **0 violations** | `axe-live.json` |
| 2 | Pa11y / HTML_CodeSniffer | 34 public pages | 34 scanned, 0 not-tested, **0 errors** | `pa11y-live.json` |
| 3 | Dynamic states | 13 scenarios | 13 scanned, **0 violations, 0 horizontal scroll** | `dynamic-states.json` |
| 4 | Keyboard and manual | 9 checks | 7 PASS, 1 FAIL, 1 NOT_TESTED — both resolved below | `keyboard-live.json` |
| 5 | NVDA | Windows 11 + Edge, via BrowserStack | Run against the live site | BrowserStack session archive |
| 6 | VoiceOver | macOS + Safari, via BrowserStack | Run against the live site | BrowserStack session archive |
| 7 | VoiceOver | macOS + Safari, local | Run by the site owner; reading worked | Screen recording, held locally |

The 13 dynamic scenarios: mobile menu (he/en), FAQ expanded, date picker
open, cookie banner, review form, contact, condition report, reflow at 320px
(home and rental), zoom equivalents at 200% and 400%, and reduced-motion.

JAWS was **not** tested and must not be referred to anywhere.

## The two non-PASS entries in `keyboard-live.json`, resolved

Both were re-examined against production on the same day rather than left
open.

### FAIL — "Visible focus indicator on every tab stop — contact (he)"

Reported 4 of 30 tab stops with no indicator. All four are the same node:
`<div><input type="hidden" name="cf-turnstile-response" id="cf-chl-widget-…">`
— markup Cloudflare Turnstile injects, not ours.

Re-checked on production: every one of those nodes reports `tabIndex: -1`
and carries no `tabindex` attribute, so **none of them is reachable by Tab**.
The harness reached them by focusing programmatically, which is not what
2.4.7 measures.

**Verdict: false positive.** No code change. Consistent with the separate
audit the same day, which also recorded a single Turnstile false alarm.

### NOT_TESTED — "Booking extras checkboxes keyboard-reachable"

The harness could not complete it: it ran locally without Supabase
credentials, so it could not open a vehicle page.

Completed against production. The add-ons only render once dates are chosen
(`totalDays > 0`), which is why a plain page load finds nothing — the first
re-run missed them for that reason too. With dates supplied:

    /he/rental/<id>?pickup=2026-09-01&return=2026-09-04

All four add-ons — damage-waiver reduction, Highway 6, child seat, extra
driver — are `tabIndex: 0`, receive focus, are named by the wrapping
`<label>`, and the label carries `focus-within:ring` so focus is visible on
the card.

**Verdict: PASS.**

## Reading these files

`keyboard-live.json` records status per check with the evidence attached, and
`pa11y-live.json` records `SCANNED` vs `NOT_TESTED` per page with a summary
block. That distinction is deliberate: an earlier run recorded a browser that
never started as a page with zero issues, and a run that cannot scan must
never read as a pass.
