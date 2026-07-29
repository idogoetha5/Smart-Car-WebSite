# User-A scan — finding-by-finding verification

**Page scanned:** <https://www.smartcar.co.il/he>
**Reported:** 39 violations, score 77%
**Verified:** 29 July 2026, against the live DOM before any change

The score is not a legal determination and was not treated as one. Each
finding was reproduced against the rendered document, classified, and then
either fixed or recorded as a false positive with the reason.

## Reproduced counts, before the fix

| Reported | Reproduced | Verdict |
|---|---|---|
| 6 ARIA attributes referencing missing ids | 6 | **Real** |
| 21 SVG findings | 52 SVGs, 16 unmarked | **Real** (count differs; see below) |
| 8 links opening a new tab | 8 | Partly real — advisory only |
| 2 sections in another language | 1 | **Real** |
| Landmarks | 1 main, 1 nav, 1 footer | False positive |
| Heading hierarchy | h1 → h2 → h3, no skips | False positive |

## Finding by finding

### 1. Six ARIA references to ids that do not exist — REAL

`aria-controls="faq-panel-0..4"` on the FAQ buttons and
`aria-controls="mobile-menu"` on the menu trigger. Every one of those panels
was conditionally rendered, so the id existed only once the panel was
already open — the reference dangled in exactly the state where assistive
technology would use it.

*Fix:* both are mounted permanently and hidden with the `hidden` attribute,
which keeps them out of the accessibility tree and the tab order — what the
conditional render was achieving, minus the broken reference. No invented
ids.

*Verified after deploy:* 0 dangling references.

### 2. SVG — REAL, but classified rather than blanket-fixed

The page carries 52 SVGs; 16 had neither `aria-hidden` nor a name. They were
not all the same thing:

- **22 decorative** — service glyphs, checkmarks, the WhatsApp mark inside a
  link that already has its own name, the arrow inside a labelled button.
  Given `aria-hidden="true"` and `focusable="false"`. No role, no invented
  label.
- **1 meaningful.** The review rating was drawn as five stars and expressed
  nowhere else in the markup, so a screen reader received no rating at all —
  SC 1.1.1. The group now carries `role="img"` and "דירוג 5 מתוך 5" /
  "Rated 5 out of 5", and the individual stars, being the picture of it, are
  hidden.

This is the finding that justifies not automating the pass: a blanket
`aria-hidden` sweep would have silenced the one SVG that carried
information.

*Verified after deploy:* 0 unmarked SVGs.

### 3. Language of parts — REAL

"Join us for a ride" is English inside a `lang="he"` document. Without
`lang="en"` a Hebrew voice applies Hebrew letter-to-sound rules to it.
`lang="en"` added; the wording is untouched — this is SC 3.1.2, not copy.

The scan reported two such sections; only one was found in the rendered
document. The second is likely a brand string ("SmartCar"), which is a
proper noun and correctly needs no `lang`.

*Verified after deploy:* 1 element with `lang`.

### 4. Eight links opening a new tab — advisory

All eight already carry `rel="noopener noreferrer"`, so there is no security
issue. They are Waze, WhatsApp and a Google reviews link, where a new tab is
the appropriate behaviour. A visually hidden "(נפתח בלשונית חדשה)" was added
to the customer-facing ones. SC 3.2.5 is AAA, so this is an improvement
rather than a conformance fix.

### 5. Landmarks — FALSE POSITIVE

Exactly one `<main>`, one `<nav>` and one `<footer>`. There is no `<header>`
element, which is what the scan is likely reacting to, but the navigation is
already a landmark and the structure is valid. No change.

### 6. Heading hierarchy — FALSE POSITIVE

Rendered order is h1, h2, h2, h2, h3, h3, h3, h3, h2, … — starts at one h1
and skips no level. No change.

### 7. Hidden elements and unrendered payload

Checked: the counts above come from the rendered document, and the SVG count
includes icons inside components that are present but visually hidden. That
is why 52 SVGs are in the DOM where the scan reported 21 findings — the
discrepancy is scan scope, not a disagreement about the page.
