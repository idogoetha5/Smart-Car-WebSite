# SmartCar — Handbook for AI agents (Claude, Codex, any tool)

**Read this whole file before you change anything in the driver or manager apps.
When you finish a task, update this file in the same commit** (see "Keeping this file current" at the end).
`AGENTS.md` holds the hard rules (QR codes, mobile threshold, look and feel). This file explains the system and how to work on it.

The owner, Ido, is not technical. He writes in Hebrew and expects work done end to end: built, checked, deployed and verified on the live site. Report back to him in short, plain Hebrew, with no jargon.

---

## 1. What exists

`smartcar.co.il` is one Next.js app (SmartCar car rental). It contains three things:

| Part | URL | Who | Notes |
|---|---|---|---|
| Public website + booking | `/he`, `/en`, ... | Customers | next-intl, locale-prefixed. |
| Admin | `/he/admin/*` | Office (Ido, Daniel) | `admin_auth` cookie. The "נהגים" page shows the manager views as tabs (`ManagerWorkspace`). |
| **Driver app** | `/driver/*` | Drivers, on phones only | PWA, no app store. Login: name + 4-digit PIN. |
| **Manager app** | `/driver/manage/*` (`/manager` redirects here) | Branch managers, on phone **and** computer | PWA. Login: `/driver/manager-login`, names of managers + 4-digit PIN. |

### Driver app (`/driver`)
- **היום / מחר / חיפוש** tabs (`src/app/driver/page.tsx`, data from `GET /api/driver/today?date=today|tomorrow` or `?search=`).
- Sections: "דחוף · מי לוקח?" (open urgent jobs, first to tap "אני לוקח את המשימה" gets it, atomic claim, 409 if taken), דחוף, מסירות, החזרות, טיפול ברכב, שטיפות.
- Each card: Waze (address optional, editable on the card), call, WhatsApp "אני בדרך" (`src/lib/driver-on-the-way.ts`, signs as "נציג SmartCar"), "סמן כבוצע". Done or signed tasks disappear after 24h.
- **Inspection** (`/driver/inspection/new?bookingId=&type=pickup|return`): km + fuel in eighths (km can be read from a dashboard photo through Gemini, `/api/driver/odometer-ocr`), optional video with "דלג", damage marking on a car diagram with optional photos, optional checklist inside the damage step. On a **return**, handover damage shows grey and only new damage is marked (red).
- **Sign** (`/driver/inspection/[id]/sign`): the customer sees everything plus the declaration (`src/lib/inspection-declaration.ts`, pickup "אישור מסירת רכב", separate return declaration) and signs with a finger. A signed PDF goes by email to the customer and the office. If the customer isn't there, the driver can send a signing link.
- Works offline: inspections are queued on the phone and sent when signal returns.
- **Quick booking** (`/driver/quick-booking`): walk-in customer → handover. For a return, the driver searches the customer or plate among signed handovers (any driver's), and the return opens on that booking.
- Licence plate is **required** for drivers. Fleet cars with no plate ask for one.

### Manager app (`/driver/manage`)
Shell `src/components/app/ManagerShell.tsx` (sidebar on a computer, bottom tabs + floating "משימה חדשה" on a phone). Shared data in `src/components/manager/ManagerData.tsx` (SWR, refreshes quietly every 60s).
- **Actions:** "משימה חדשה" (מסירה/החזרה, any date, optional "create the return too"), and three quick actions: **משימה להיום** (urgent, now / within 1h / 2h / during the day; send to one driver or to all, first to take it), **שטיפה** (driver + car, send), **טיפול ברכב** (garage / tyres / test, with a reason). Form: `src/components/admin/DriverTaskForm.tsx` inside `NewTaskSheet`.
- **היום** (`TodayView`): greeting, global search, "חריגות ונזקים מההשכרה האחרונה" (`RentalAlertsPanel`), alert chips (late, unassigned, awaiting signature, urgent), a 14-day strip and the day's tasks. Tapping a task opens `TaskSheet` (change driver, date/time, address, cancel, delete after cancel, PDF/video).
- **יומן** (`CalendarView`): month grid and list of all future tasks; create a task on any day.
- **רכבים** (`VehiclesView`): fleet with status (בסניף / אצל לקוח / במוסך / לשטיפה), last km, last wash, next test date, history (garage, washes, handovers, returns). Add a car (plate, test date, km, ...) and delete a car (trash icon, with confirmation). API `/api/driver/manage/fleet` and `/fleet/[id]`.
- **נהגים** (`DriversView`): drivers with today/tomorrow load and notification status. Managers can add drivers, disable them and reset their PIN. Managers cannot create managers; only the admin can.
- **מסמכים**: signed inspections with PDF and video.
- License plate is **optional** for managers and admin.

### Rental exceptions ("חריגות")
`src/lib/rental-alerts.ts`, API `/api/driver/manage/rental-alerts`, table `rental_alert_reviews`. Each signed return is compared with its handover:
- **km:** allowance from `mileageAllowanceKm()` in `src/lib/inspection-deviation.ts`: 200 km/day up to 7 days, 220 km/day for days 8–30, 2,500 km per 30 days above that. Rental days come from the handover and return signing times. A return reading lower than the handover is also flagged.
- **fuel:** returned with less than at handover.
- **damage:** marks on the return that were not on the handover.
The manager ticks "סמן כטופל" and the case stays in a grey history. Covered by tests (`rental-alerts.test.ts`, `inspection-deviation.test.ts`).

### Notifications (Web Push)
Texts in `src/lib/push-messages.ts` (human, polite, short Hebrew; each task type has its own: מסירה / החזרה / נסיעה למוסך / שטיפה / urgent / urgent-open). Hooks in `src/lib/push-notify.ts`, sending in `src/lib/push.ts`, service worker `public/driver-sw.js`, bell `src/components/app/PushBell.tsx`. Morning summary cron `/api/cron/driver-morning` (04:30 UTC). Managers are told when a form is signed or a return has an exception.

---

## 2. Accounts and sessions — read before touching auth

- Table `drivers`: `id, name, pin_hash, active, role ('driver' | 'manager')`. **One person can have two rows**: Ido has a manager row **and** a driver row named "עידו". Tasks are assigned to the **driver** row. Do not delete the manager row "עידו" without his approval.
- **Two separate cookies** (since 1 Oct 2026), so one phone can be logged in to both apps:
  - `driver_auth` → the driver app. Set when a `role='driver'` row logs in.
  - `manager_auth` → the manager app. Set when a `role='manager'` row logs in.
  - Older manager sessions stored in `driver_auth` still work in the manager app. When a driver logs in on that phone, the old manager session is moved to `manager_auth`.
- Helpers in `src/lib/driver-route-auth.ts`:
  - `requireDriverOrAdmin(as)`: the driver app prefers `driver_auth`; `as='manager'` prefers `manager_auth`.
  - `requireManagerOrAdmin()` accepts a manager row from either cookie, or the admin.
  - Shared routes take `?as=manager` from the manager app: `/api/driver/me`, `/api/driver/push`, `/api/driver/push/test`, and `DELETE /api/driver/login` (logout of one app only).
- `src/proxy.ts`: `/driver/manage/*` pages accept either cookie; other `/driver/*` pages need `driver_auth` (or admin). If the driver app is opened with a manager session, it shows "מחוברים כאן כמנהל" with a "כניסה כנהג" button instead of an empty day.
- **Known bug (fixed 1 Oct 2026):** both apps used one cookie, so logging in to the manager app logged the phone out of the driver role. The driver app then showed no tasks ("assigned task doesn't appear"). Don't merge the cookies again.
- Claude Code / AI agents never type PINs on the live site. Ask Ido to log in himself.

---

## 3. Data model (Supabase, project "Smart Car", free plan; do not upgrade it)

- `bookings`: real customer bookings, plus "field jobs" created from the apps (`source='driver'|'phone'`, price 0; hidden from "ניהול הזמנות" and the dashboard). `pickup_date`/`dropoff_date` are timestamptz; `pickup_time`/`return_time` are "HH:MM"; `custom_vehicle_name`, `custom_license_plate`.
- `driver_tasks`: `type 'pickup'|'return'|'service'`, `status 'open'|'done'|'cancelled'`, `assigned_driver_id` (null = unassigned / open urgent), `urgent`, `booking_id` (null for service). Service and wash use `vehicle_id`/custom car, `scheduled_at`, `scheduled_time`, `location`, `service_kind` (`garage|tire|wash|test|other`), `service_reason`, `service_place`. **A pickup/return task's day is the booking's `pickup_date`/`dropoff_date`** (Israel day, `src/lib/israel-day.ts`).
- `vehicle_inspections`: pickup/return, km, fuel_eighths, damage_marks, checklist, `handover_inspection_id`, status `awaiting_signature|signed`, PDF/video paths.
- `vehicles`: fleet (+ `test_due_date`, `current_odometer_km`).
- `rental_alert_reviews`, `push_subscriptions`.
- RLS is "service role only" everywhere. Server code uses `createAdminClient()`.
- Migrations live in `database/migrations/*.sql`, written to be safe to re-run. **Run every new migration in the Supabase SQL editor before deploying code that needs it.** All migrations up to `add-vehicle-fleet-details.sql` have run in production (1 Oct 2026).

---

## 4. How to work on it

1. **Branch from `clean-main`** (the production branch). Do not touch the customer-form QR codes or URLs (AGENTS.md).
2. Next.js 16 with breaking changes: read `node_modules/next/dist/docs/` before using framework APIs. Route params are `Promise`s; `src/proxy.ts` replaces middleware; `after()` from `next/server` for background work.
3. UI rules (AGENTS.md): 360px with no horizontal scroll, tap targets ≥44px, inputs ≥16px, `Sheet` for details, `useToast()` for feedback, no "behind the scenes" wording, brand colours (`#F4F7F7`, teal `#2D5F5F`, orange `#E8743B` only for the main action, `#0D2B2B` headings, indigo for garage, sky for wash).
4. Texts: Hebrew, professional and warm, short. Notifications in `push-messages.ts` with tests in `src/lib/__tests__/push-messages.test.ts`.
5. **Checks before every merge:**
   - `npx tsc --noEmit`
   - `npm run lint` (one known warning in `BookingForm.tsx`), `npm run lint:budget`
   - `npm test` (vitest, ~690 tests)
   - Mobile audit: `npm run dev`, then `npm i --no-save playwright && npm run audit:mobile`. It must print "All driver screens pass the mobile threshold". Add new screens and mocks to `scripts/mobile-audit/run.mjs`, and look at the screenshots.
   - Visual check: `BASE=http://localhost:3000 node scripts/mobile-audit/review.mjs` → `scripts/mobile-audit/out/review/`.
6. Commit as Ido (`Ido Goetha <ido.goetha5@gmail.com>`). Never commit secrets (`.env*`, VAPID keys, service keys).
7. There are no extra worktrees anymore; work on branches from clean-main.

## 5. How to deploy (go live)

1. Run the new migrations in Supabase (SQL editor, project "Smart Car" → main/Production), then check that the new columns and tables exist.
2. Merge the branch into `clean-main` and run the checks above.
3. `git push origin clean-main`. Vercel deploys production from it automatically, and GitHub CI runs (verify + audit jobs). `npx vercel deploy --prod --yes` also works from a clean checkout. If the CLI fails with "File size limit exceeded", delete the local `.next` cache. For a local `vercel build`, move `.env.local` aside so it doesn't override the production env.
4. Verify on the live site: `/driver/manage` (logged in as a manager) and `/driver` (logged in as a driver). Check `/api/driver/today` returns the expected tasks, and that the browser console has no errors.
5. Env on Vercel Production: Supabase keys, `DRIVER_COOKIE_SECRET`, `ADMIN_COOKIE_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, Resend, Gemini, Turnstile. Never print them.
6. Tell Ido in Hebrew what changed, and what he should check on his phone.

## 6. Open items

- Real field test: one full handover and return from a driver's phone (video, damage, signature, emails).
- A lawyer should review the handover and return declarations.
- Push on one phone that is both a driver and a manager: the phone's subscription belongs to whichever app last turned notifications on.
- Old data: booking for "Ido Goetha" has `dropoff_date` before `pickup_date` (test data).

---

## Keeping this file current (mandatory)

After **every** task that changes behaviour, data, routes, env, deploy steps or rules:
1. Update the relevant section above. Facts only: what exists, where it lives, and how it works.
2. Add a line to the change log below: date, what changed, branch/commit, migrations, deployed yes/no.
3. Commit this file in the same commit or PR as the change.

### Change log
- 2026-10-01 — Separate driver/manager sessions (`manager_auth`). Fixes tasks not showing in the driver app after a manager login. Branch `fix/separate-sessions`, merge 828849a. No migration. Deployed.
- 2026-10-01 — Rental exceptions panel, fleet add/delete with test date and km, copy polish (Codex). Commits 65aad9e, 474da35. Migrations `add-rental-alert-reviews.sql`, `add-vehicle-fleet-details.sql`. Deployed.
- 2026-10-01 — Wash and car care as their own jobs, "משימה להיום", vehicles page, task-type notifications. Commit 8affa96. Migrations `add-service-tasks.sql`, `add-urgent-tasks.sql`. Deployed.
- Earlier (Sep 2026): driver app, inspections with signature and PDF, return comparison, manager app v2 (day board, calendar, search, reschedule), Web Push, brand redesign, urgent tasks, garage tasks.
