# SmartCar Accessibility Audit — 2026-07-27/28

## Scope and method

Automated + manual audit of the public-facing site (32 page/locale combinations: 16 routes × `he`/`en`), covering homepage, catalog, rental, leasing, cars-for-sale, branches, about, contact, terms, insurance, privacy, cookies, accessibility, condition-report, my-bookings, and booking-confirmation. Admin panel (`/admin/*`) was explicitly out of scope (internal staff tool, not customer-facing).

**Tools used** (both run against a local dev server, real rendered DOM, not static HTML):
- **pa11y** (HTML_CodeSniffer engine, WCAG2AA ruleset) — full run of all 32 URLs, before and after fixes.
- **axe-core** (via `@axe-core/puppeteer`, `wcag2a` + `wcag2aa` + `wcag21aa` tags) — full run of all 32 URLs, before and after fixes, as an independent second engine (different rule implementation, catches different issue classes — e.g. axe found several color-contrast failures pa11y's engine missed, and vice versa neither replaces manual review).

Raw results: `a11y-before.json` (pa11y, first run), `a11y-after.json` (pa11y, final run), `axe-results.json` (axe-core, final run — the pre-fix axe run was not saved to a separate file, but its findings are folded into the fix list below). These are working artifacts, not committed to git.

**Manual checks performed** (things automated tools structurally cannot verify): heading hierarchy on homepage/insurance/leasing (clean h1→h2→h3, no skipped levels, single h1 per page); alt-text quality on all `<Image>`/`<img>` usages outside admin (all descriptive, none filename-based or generic); keyboard-trap check on the one non-native interactive widget on the site (the custom date picker); cookie-consent banner keyboard/focus behavior.

## Results

| | pa11y violations | axe-core violation groups |
|---|---|---|
| Before | 442 (across 32 pages) | 18 (across 32 pages) |
| After | 0 | 0 |

**Important caveat on "0 violations":** this means zero violations detected by these two specific automated tools against the WCAG2AA ruleset, on the specific pages and interactive states we tested (default page load; forms not exercised through every validation/error state; no in-app cart/payment flow since that's not implemented). It is **not** a certification of full WCAG 2.1 AA or Israeli Standard 5568 compliance — automated tools catch an estimated 30-50% of real WCAG issues industry-wide. It means the two most common, highest-volume categories of violation (color contrast, missing accessible names on form controls) that existed on this site have been found and fixed, and the site should be re-scanned after any significant UI change.

## What was fixed

**1. Color contrast (the overwhelming majority of violations — ~410 of 442 pa11y hits, plus ~90 axe hits before consolidation by unique cause):**
- The brand orange `#E8743B`, used as both text color and as a button background with white text, measured 3.0:1 against white — below the 4.5:1 AA minimum for text. Root-caused to a single color choice reused ~115 times across ~30 files. Fixed by introducing two evidence-computed replacement shades used contextually: `#C24E17` for button backgrounds with white text (4.78:1 vs white), and `#B64916` for standalone orange text/borders on light backgrounds (5.31:1 vs white, 4.68:1 vs the site's cream `#F5F0E8` section background — the worst-case background actually used). The original `#E8743B` was correctly *kept* in the ~5 places it's used as text on the dark teal (`#0D2B2B`) hero/stats backgrounds, where it already passed (5.0:1) — an early blanket-replace attempt broke these by darkening them incorrectly; caught by the axe/pa11y rescan and reverted to the original color in those specific spots.
- Footer bottom-bar links and copyright text (`#5a9080` on `#0D2B2B`, 4.1:1) → reused an existing lighter shade already in the same file's palette (`#7fb09f`, 6.16:1).
- Generic Tailwind `text-gray-400` / `text-gray-500` utility classes (this Tailwind version's actual hex: `#99a1af` / `#6a7282`) — used as the default "secondary/muted text" color in ~44 files, and measuring as low as 2.29:1 on the site's various light backgrounds. Consolidated to `text-gray-600` (`#4a5565`), which clears every background color combination found on the site with margin (6.27:1 even on the lightest hero background `#D6EEF5`).
- WhatsApp button green (`#25D366` on white, 1.98:1) → darkened to `#178540` (4.70:1) on the 3 customer-facing WhatsApp CTA buttons that carry visible text (the floating icon-only WhatsApp button was left untouched — no text node, contrast rule doesn't apply the same way).
- Waze button blue (`#00ADEF` on white, 2.55:1) → darkened to `#007DAC` (4.64:1).
- `text-red-600`/`text-red-500`/`text-green-600` (Tailwind defaults) on light backgrounds, in the insurance exclusions list and branches open/closed status — darkened to `#C10007` and `#007A3D` respectively.
- Several low-opacity text utilities (`text-white/30`, `text-white/80`, `text-orange-100`) sitting directly on the orange/dark-teal brand backgrounds, computed below 4.5:1 once the actual alpha-blended color was measured — bumped to full-opacity white or a higher-opacity white as appropriate.

**2. Missing accessible names on form controls (~66 pa11y hits):** every `<select>`, text/email/number `<input>`, `<textarea>`, and range slider that lacked a programmatic name (no associated `<label for>`, no `aria-label`) — even where a *visually adjacent* `<label>` existed but wasn't actually associated in markup. Fixed with `aria-label` matching the visible label text, across: the homepage hero pickup/return location fields, the newsletter email field, catalog filters (category/transmission/fuel/price-range/search), rental page filters, leasing calculator + inquiry form (vehicle select, duration slider, down-payment slider), and all condition-report fields (booking ID, customer name, odometer, fuel level, notes).

**3. Keyboard trap (found only by manual review, not by either automated tool):** the custom date picker (`DatePickerInput.tsx`, used for pickup/return dates site-wide) opened a calendar popup with no keyboard way to close it — only a pointer click outside would dismiss it, meaning a keyboard-only user who opened it via Enter/Space could get stuck. Fixed: `Escape` now closes the popup and returns focus to the trigger button; added `aria-haspopup="dialog"` / `aria-expanded` on the trigger and `role="dialog"` on the popup for correct screen-reader semantics.

**4. Removed false compliance claims (`/accessibility` page, fixed earlier in this session, included here for completeness):** the accessibility statement previously asserted the site had been *tested and confirmed working* with specific screen-reader/browser combinations, and that contrast had been *verified* — neither had actually happened. Reworded to accurately describe implemented measures and an ongoing conformance process, without asserting unperformed testing.

## Not fixed / explicitly out of scope

- **Admin panel** (`/admin/*`) was not audited — internal tool, not customer-facing, lower priority. Recommend a separate pass before treating it as accessible.
- **Full keyboard-only end-to-end walkthrough** of the booking flow, condition-report submission, and admin login was not performed live in a real screen reader (NVDA/JAWS/VoiceOver) — the site's own former claim of having done this was exactly the false claim removed in fix #4. If a real screen-reader walkthrough is wanted, it should be done by an actual screen-reader user or a specialist, and the accessibility statement updated only once that's genuinely done.
- **Dynamic/error states** of forms (validation error messages, loading states, the review-submission success/error banners) were spot-checked in code but not exhaustively scanned in every state — pa11y/axe only see whatever DOM state is present at page load.
- **PDF output** (the admin quote-generation feature) was not assessed — PDFs have separate accessibility requirements (tagged PDF/PDF-UA) not covered by web scanning tools.

## Honest one-paragraph summary (for use in the accessibility statement, not as a replacement for it)

As of this audit, the site has zero automatically-detectable WCAG 2.1 AA violations across all 16 customer-facing page templates in both Hebrew and English, per two independent scanning engines (pa11y/HTML_CodeSniffer and axe-core), covering color contrast and form-control naming — previously the two largest real gaps, now fixed. One keyboard-trap issue in the custom date picker, found only through manual review (not either automated tool), was also fixed. This is real, evidence-based progress, not a certification of full compliance: automated tools have known coverage limits, and a genuine screen-reader walkthrough by an actual user has not yet been performed. The site's own accessibility statement has been corrected to reflect this honestly rather than claim completed testing that didn't happen.
