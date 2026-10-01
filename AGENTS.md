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

| Branch | Short link to send on WhatsApp (English form by default) | QR URL (do not touch) |
|--------|------|------|
| herzliya | `https://www.smartcar.co.il/f/herzliya` | `https://www.smartcar.co.il/en/customer-details?branch=herzliya` |
| telaviv | `https://www.smartcar.co.il/f/telaviv` | `https://www.smartcar.co.il/en/customer-details?branch=telaviv` |
| jerusalem | `https://www.smartcar.co.il/f/jerusalem` | `https://www.smartcar.co.il/en/customer-details?branch=jerusalem` |
| airport | `https://www.smartcar.co.il/f/airport` | `https://www.smartcar.co.il/en/customer-details?branch=airport` |

The short link `/f/<branch>` is only a redirect to `/en/customer-details?branch=<branch>` (English is the default; the form's language button switches to Hebrew) (defined in `redirects()` in `next.config.ts`; `f/` is excluded from the next-intl matcher in `src/proxy.ts`). The printed QR codes do not use it.

## Driver app: mobile-first is a hard requirement

Drivers and branch managers use the driver app (`/driver/*`, `src/components/inspection/*`, the sign screens) **only on their phones**, often one-handed and outdoors. Any change there is not done until it passes this threshold:

- Works at 360px wide with no horizontal scrolling.
- Every button/link/input is at least 44x44px (prefer 56px for main actions). Main action = one big full-width button; secondary actions go in a bottom sheet, not a wall of buttons.
- Text inputs use at least 16px font (`text-base`), so iPhones don't zoom in.
- Fixed bottom bars and sheets respect `env(safe-area-inset-bottom)`.
- Branch managers (`/driver/manage/*`, `/driver/manager-login`, `src/components/manager/*`, `DriverTaskForm`) use it on **both phone and computer**: it must also look right at 1366px wide (centred, no stretched single-column walls). The audit checks these screens at desktop size too.
- Before merging, run the audit and look at the screenshots it saves:
  `npm run dev` then `npm i --no-save playwright && npm run audit:mobile` (screenshots in `scripts/mobile-audit/out/`). It must print "All driver screens pass". When you add a new driver screen, add it to the list in `scripts/mobile-audit/run.mjs`.

## Phone notifications (Web Push) for drivers and managers

- Texts live in `src/lib/push-messages.ts` (keep them human, polite and short, in Hebrew); sending in `src/lib/push.ts`; task-change hooks in `src/lib/push-notify.ts`; service worker `public/driver-sw.js`; opt-in bell in the top bar `src/components/app/PushBell.tsx`.
- Needs env vars on Vercel (Production): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:office@smartcar.co.il`). Generate once with `npx web-push generate-vapid-keys`. Never commit them. Changing the keys invalidates every phone's subscription.
- Without the keys everything still works; notifications are simply off and the opt-in card stays hidden.
- Table `push_subscriptions` (migration `database/migrations/add-push-subscriptions.sql`). Morning summary cron: `/api/cron/driver-morning`.

## Driver & manager apps: look and feel

- One visual language: page background `#F4F7F7`, white rounded-3xl cards with a hairline ring (`ring-1 ring-black/[0.04]`), teal `#2D5F5F` for selection/secondary actions, orange `#E8743B` only for the main action on a screen, dark teal `#0D2B2B` for headings.
- Lists are rows inside one white card (`TaskList` + `TaskRow`); details and edits open in a `Sheet` (bottom sheet on a phone, drawer/dialog on a computer) instead of crowding cards with buttons.
- Feedback with `useToast()` from `src/components/ui/AppToast.tsx`, never `alert()`/`confirm()`/`prompt()`.
- Never show behind-the-scenes wording to users ("מתעדכן אוטומטית", "רענון", technical states). Data refreshes quietly (SWR `refreshInterval`).
- Manager app structure: shell `src/components/app/ManagerShell.tsx` (sidebar on a computer, bottom tabs + floating "משימה חדשה" on a phone), data `src/components/manager/ManagerData.tsx`, pages היום / יומן / נהגים / מסמכים under `/driver/manage/*`. The admin "נהגים" page shows the same views as tabs (`ManagerWorkspace`).
- For a visual check, `BASE=http://localhost:3000 node scripts/mobile-audit/review.mjs` saves phone and computer screenshots of the main screens to `scripts/mobile-audit/out/review/`.
