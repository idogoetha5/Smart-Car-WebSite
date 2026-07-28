# Accessibility scan evidence

`pa11y-production-*.json` is a pa11y (HTML_CodeSniffer, WCAG2AA) scan run
against the **live production site**, not a local build — the URL list in
`scripts/a11y-urls.txt` points at https://www.smartcar.co.il.

Reproduce with:

    bash scripts/run-a11y.sh evidence/a11y/pa11y-production-$(date +%Y%m%d).json

## 2026-07-28 run

34 page/locale combinations scanned. **2 errors**, both the same defect:
the email input on `/he/my-bookings` and `/en/my-bookings` had no
accessible name, because its `<label>` was never tied to the field. Fixed
by adding `htmlFor`/`id` (plus `name` and `autocomplete="email"`).

An automated scan is not a conformance statement — it detects only part of
what matters. The gaps recorded in ACCESSIBILITY-EVIDENCE.md, above all a
walkthrough with a real screen reader, remain open.

## Production run, 2026-07-28 16:04 UTC

34 of 34 URLs scanned, 0 not-tested, 0 errors, produced by the rewritten
`scripts/run-a11y.sh`.

That "0" is only meaningful because the script now distinguishes a scanned
page from one it could not reach. The previous version turned an empty pa11y
result into `[]`, and pa11y exits 0 even when the browser fails to launch — so
a total failure was recorded as a clean sweep. It happened during this
session: pa11y's puppeteer pins Chrome 148 and that install was corrupt, so
every page returned nothing. The old script would have reported a pass.

Exit codes: 2 if any page could not be scanned, 1 on real errors, 0 only on a
genuine pass. All three verified against live URLs.

**Not a conformance claim.** pa11y is a static scan. It does not cover keyboard
traps, screen-reader flow, focus management, or any form that appears only
after an interaction — the leasing enquiry and the review widget among them.
Those still need manual testing with VoiceOver/NVDA.

JSON reports stay untracked (`.gitignore`): they are bulky and regenerable.
Written-up findings under `evidence/**/*.md` are tracked.
