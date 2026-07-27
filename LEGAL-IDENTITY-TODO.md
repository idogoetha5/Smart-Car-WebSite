# Legal identity — pending real values

Israeli consumer law expects a distance-selling vendor to publish its full
legal identity. These values are **not yet known** and must not be
fabricated. They are deliberately **omitted** from the live site rather
than rendered as visible `[PLACEHOLDER]` text, which would look broken to
real customers (owner's explicit instruction, 2026-07-27).

Ido is obtaining the real values from Daniel.

## Values needed

| Placeholder | Meaning | Status |
|---|---|---|
| `LEGAL_NAME` | Full registered company name | pending |
| `COMPANY_NUMBER` | ח.פ. / ע.מ. | pending |
| `NOTICE_ADDRESS` | Registered address for legal notices | pending — the operational address (רמת ים 122, הרצליה) is already published, but confirm it is also the address for service |
| `LICENSE_NUMBER_IF_REQUIRED` | Car-rental operator licence number, if one is legally required to be displayed | pending — needs a lawyer's determination on whether display is mandatory |

## Where each must be added once known

1. `src/app/[locale]/terms/page.tsx` — section 1 (הגדרות / Definitions), both
   the Hebrew and English blocks. The empty `(ח.פ. / ע.מ.)` parenthetical
   was removed from here on 2026-07-27; restore it with the real number.
2. `src/app/[locale]/privacy/page.tsx` — section 1 (מי אנחנו / Who we are),
   both locales — identify the data controller by full legal name + number.
3. `src/components/layout/Footer.tsx` — the contact block, so the identity
   is reachable from every page and not only from the legal pages.
4. `src/app/[locale]/booking-confirmation/page.tsx` — the vendor identity on
   the transaction confirmation.

Do **not** change the About page for this; if a legal disclosure is ever
required there, add the minimum and show the diff separately for approval.
