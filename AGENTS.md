<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## NEVER change the customer-form QR codes

The four branch QR codes (herzliya, telaviv, jerusalem, airport) are already printed and physically placed in the branches. They must NEVER be changed or regenerated. This applies to every AI agent and human working here:

- Do not modify, replace, regenerate or delete the QR images in `טפסי לקוחות/QR/` or the print PDFs in `טפסי לקוחות/חוברות להדפסה/`.
- Do not change the URLs they point to: `https://www.smartcar.co.il/en/customer-details?branch=<branch>`. Keep the `customer-details` route, the `branch` query parameter and the branch ids (`herzliya`, `telaviv`, `jerusalem`, `airport`) working exactly as they do now.
- Do not re-run `scripts/customer-forms/*` in a way that overwrites the existing QR files.
- Changing what the form itself does (fields, styling, validation) is fine, as long as those URLs keep working.

Customer-form links per branch (single source of truth, keep this table in sync with `README.md`):

| Branch | Short link to send on WhatsApp (Hebrew form) | QR URL (do not touch) |
|--------|------|------|
| herzliya | `https://www.smartcar.co.il/f/herzliya` | `https://www.smartcar.co.il/en/customer-details?branch=herzliya` |
| telaviv | `https://www.smartcar.co.il/f/telaviv` | `https://www.smartcar.co.il/en/customer-details?branch=telaviv` |
| jerusalem | `https://www.smartcar.co.il/f/jerusalem` | `https://www.smartcar.co.il/en/customer-details?branch=jerusalem` |
| airport | `https://www.smartcar.co.il/f/airport` | `https://www.smartcar.co.il/en/customer-details?branch=airport` |

The short link `/f/<branch>` is only a redirect to `/he/customer-details?branch=<branch>` (defined in `redirects()` in `next.config.ts`; `f/` is excluded from the next-intl matcher in `src/proxy.ts`). The printed QR codes do not use it.
