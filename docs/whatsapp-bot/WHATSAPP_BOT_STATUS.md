# WhatsApp Bot Status & Handover

## Latest session (Aug 29, 2026) — bot conversation bugs FIXED, deployed to production

The "doesn't send a quote" bug from Aug 21 (below) is **resolved** — the diagnosis in that
section was on the wrong track. The real causes, found and fixed this session:

1. **Gemini ran before the deterministic confirm-step handler and always returned early**,
   so the code that calls `createRentalRequest` + generates the matching PDF quote
   (`generateWhatsAppPdfQuoteLink` in `whatsapp-pdf.ts`) was unreachable. Gemini would
   hallucinate a plausible "your request has been confirmed" reply without ever saving
   anything or notifying staff. Fixed: the `rental_confirm` step is now handled
   deterministically at the very top of `getWhatsAppFlowReply`, before Gemini is called
   at all. See commit `4005e03`.

2. **`requiresHumanHandoff`'s keyword list fired on ordinary mid-conversation words** —
   "לשנות" (change), "מאחר"/"איחור" (late), "להאריך" (extend), "ביטול" (cancel) — none of
   which mean the customer wants a human. This made the bot bail out to "a rep will
   contact you" constantly while still collecting a new rental request. Narrowed to
   unambiguous signals only during active new-rental collection; also gave Gemini's own
   `handoff` intent classification explicit criteria (it had none before). Same commit.

3. **The PDF quote silently failed even after fix #1**: `renderRentalQuotePdf` uses
   `@sparticuz/chromium` (headless Chrome), and Next's file tracer only knew to keep the
   binary for `/api/admin/quote-pdf/route` (`outputFileTracingIncludes` in
   `next.config.ts`). The WhatsApp webhook/simulator routes reach the same renderer via a
   dynamic import chain and were missing from that list, so it threw "chromium/bin does
   not exist" at runtime. Added both WhatsApp routes to the tracing list. Commit `5aaa37a`.

**Verified end-to-end against production** (not just code review): a full simulator
conversation — family car → dates → times → locations → name → email → "אני מאשר/ת" —
now completes, saves the request, escalates to staff, and returns a real matching PDF
quote link (same renderer/format as the admin quote system) that resolves to an actual
PDF with the correct vehicle, dates, locations and price.

**Known secondary issue, not fixed, low priority:** when a customer packs everything into
one long message, location extraction sometimes grabs the wrong text span (e.g. dumps
part of the original sentence into `pickupLocation`/`dropoffLocation` instead of just
"הרצליה"). Doesn't block completion, just makes the request messier for staff to read.
Worth revisiting `extractRentalDetails` / Gemini's location-field extraction rules in
`gemini-router.ts` if it keeps happening.

**Also worth checking separately** (not verified this session): `/api/admin/rental-quote-pdf`
and `/api/admin/rental-quote-whatsapp` call `renderRentalQuotePdf` too and are *not* in
`outputFileTracingIncludes` either — they may have the same chromium bug.

## Daniel's WhatsApp-inbox PIN trial (Aug 29, 2026)

Added a scoped 4-digit PIN login (`WHATSAPP_INBOX_PIN` env var, currently `2708`) so
Daniel can view/reply to real WhatsApp conversations at
`https://smartcar.co.il/he/admin/inbox-login` without needing the full admin
password+TOTP or a Vercel account. Implementation: `signInboxToken`/`verifyInboxToken` in
`src/lib/admin-auth.ts`, gated narrowly in `src/proxy.ts` and the
`whatsapp/conversations*` API routes — a leaked PIN cookie only exposes WhatsApp threads,
never bookings/leasing/pricing. Commits `49bb63b`, `982d2b7`.

**Important:** this inbox has nothing to show yet — see next section, no real WhatsApp
account is connected. Daniel logging in today would just see an empty list.

## RESUME POINT — WhatsApp Coexistence setup via YCloud (blocked, not started)

**Goal:** connect the real business WhatsApp number to YCloud using "WhatsApp Business
APP Coexistence" (Meta's embedded-signup flow that lets the WhatsApp Business App keep
working on Daniel's phone while YCloud's Cloud API also handles the same number — replies
mirror both ways via "Messaging Echoes"). This is the standard path to make the bot
actually receive/send real customer messages; right now `WHATSAPP_TRANSPORT` and every
related env var are unset in Vercel production, so nothing is connected at all.

**Status:** Ido has a YCloud account (company: "smartcar", Free plan) and is logged into
the console. Navigated to WhatsApp accounts → "WhatsApp Business APP Coexistence" → "Get
started" → confirmed prerequisites (business name must exactly match the registration
document — Ido confirmed it is **"סמארט קאר 2008 בע"מ"**) → clicked "I'm ready to start 🚀".

**Blocked exactly here, for two reasons:**
1. The button opens a Facebook/Meta OAuth popup. A programmatic/automated click did not
   trigger it (popup blocked or rejected as untrusted) — **this step needs Ido to click
   the button himself**, a real human gesture, then log into Facebook/Meta Business
   Manager himself (no AI tool should ever be given his Facebook password).
2. **Daniel is currently unavailable, and the flow needs him twice**: his Facebook
   account/access (likely needed for WhatsApp Business Manager permissions on this
   number), and later his physical phone to scan a QR code from the WhatsApp Business App
   itself to authorize the Coexistence link and history sync.

**Next session, resume by:**
1. Confirm Daniel is available (both his Facebook login and his phone with WhatsApp
   Business installed, version 2.24.17+).
2. Go to `https://www.ycloud.com/console/#/app/dashboard/createChannel/whatsapp-business-app`
   (or navigate WhatsApp accounts → Coexistence → Get started again).
3. Ido clicks "I'm ready to start 🚀" himself; completes the Meta business-info screen
   with business name **סמארט קאר 2008 בע"מ** and the website (smartcar.co.il).
4. When it asks to scan a QR code, Daniel scans it from his WhatsApp Business App (must
   stay open during the process). Confirmed by official docs: this does **not** delete
   anything — chats/contacts stay in the app; up to 6 months of history syncs over.
5. After onboarding, YCloud gives a `waba_id`/`phone_number_id`/API key. Set in Vercel:
   `WHATSAPP_TRANSPORT=ycloud`, `WHATSAPP_YCLOUD_API_KEY`, `WHATSAPP_BUSINESS_PHONE`,
   `WHATSAPP_YCLOUD_WEBHOOK_SECRET`. Register webhook URL
   `https://smartcar.co.il/api/whatsapp/webhook` in YCloud's dashboard.
6. Daniel must open the WhatsApp Business App at least once every 13 days to keep the
   Coexistence sync alive.

---

## Superseded — Aug 21, 2026 session (context only, bug below is now fixed, see top)

### What We Fixed That Day

1. **Intelligent Field Prompts:**
   The deterministic bot questions (like `timesPrompt` and `locationsPrompt`) were updated to intelligently ask for **only the missing half** of a requirement. For example, if the user provides the pickup location but not the dropoff, the bot now says "Great, I noted pickup from [Location]. Where would you like to return it?" instead of asking for both again.

2. **Gemini Extraction Fixes & Fallbacks:**
   - Modified `gemini-router.ts` to instruct Gemini to only extract **missing** fields, preventing it from wildly overwriting valid data.
   - Added bulletproof fallback logic in `whatsapp-flow.ts` so that if Gemini *does* accidentally overwrite a pickup field when a dropoff field is actually missing (e.g., when the user just says "מחר" followed by "עוד שבוע"), the deterministic parser identifies the duration ("עוד שבוע") and the system safely shifts the date/time to the return field without losing the pickup field.
   - Implemented duration parsing (`parseDateCandidates` and `extractRentalDetails`) to handle phrases like "עוד שבוע", "יומיים", "חודש" relative to the pickup date.

3. **Gemini Context Enhancement:**
   - Identified that Gemini lacks conversation history, making it seem "stupid".
   - Modified `FlowState` to store `lastQuestion` so Gemini can understand the context of the user's answer in the next turn.

(The "bot doesn't send a quote" bug this session tried to diagnose is fixed — see the top of this file for the actual root cause and fix.)
