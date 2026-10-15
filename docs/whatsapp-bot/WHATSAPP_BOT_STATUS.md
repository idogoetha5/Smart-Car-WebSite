# WhatsApp Bot Status & Handover

## Audit on 15 Oct 2026

- **Decision after Ido's review:** Daniel will see and test the public simulator before any Meta/YCloud connection of his business number. The Meta signup window was opened only to inspect the steps, then closed without entering a number, accepting terms, scanning a QR code, or linking an account. Do not resume onboarding without Daniel's final approval.
- Review link for Daniel: `https://www.smartcar.co.il/he/whatsapp-demo`. It is a simulation; it does not send WhatsApp messages or attach his phone. Use invented customer details. Try a natural rental request, an existing booking, "נציג", an accident/breakdown, and an English message. The real phone handoff, echo webhook, and SMS alert require a connected test/live account and cannot be proven in this simulator.
- When Daniel approves, YCloud's current guide offers **Connect by QR code**, which does not require a Facebook login or Meta business portfolio during onboarding. The alternative **Connect with Facebook** does require a Facebook account, company registration documents and website for business verification. We reached the QR-code path's Meta screen asking for the existing WhatsApp Business number, then stopped. Both paths retain the Business app. Use the QR path if Daniel prefers to keep answering on his phone. The phone app must be version 2.24.17+; Daniel authorizes the link by scanning the QR code from that app and chooses whether to sync chat history. See https://docs.ycloud.com/en/documentation/channels/whatsapp-accounts-management/coexistence/onboard-whatsapp-business-app.
- Expected handoff: incoming customer text arrives through YCloud; the SmartCar bot answers routine requests. A request for a person or an emergency produces an escalation, and Daniel can reply in his existing WhatsApp Business app. With the `whatsapp.smb.message.echoes` webhook subscribed, his app reply is logged as `human_reply` and silences the bot in that customer's conversation for 24 hours (except a new emergency safety reply). YCloud documents mirroring messages in both directions. A real echo test is required before live activation.
- YCloud console is accessible, but **WhatsApp accounts has no account** and **Developers → Webhooks has no endpoint**. An API key exists; its value was not revealed or copied.
- Vercel Production has `GEMINI_API_KEY`, but no `WHATSAPP_TRANSPORT`, `WHATSAPP_YCLOUD_API_KEY`, `WHATSAPP_BUSINESS_PHONE`, or `WHATSAPP_YCLOUD_WEBHOOK_SECRET`. The real WhatsApp number therefore does not send messages to this bot. Twilio SMS alert settings are absent too.
- The bot now uses Gemini only for bounded intent classification and evidence-backed rental fields. Fixed menu choices, emergencies, final consent, prices, availability and persistence remain controlled by application code. If Gemini fails, the deterministic flow continues. Names, email collection and messages containing an email or phone number are not sent to Gemini.
- The webhook refuses an unset transport, rejects malformed JSON, ignores group messages, and surfaces database logging failures instead of silently discarding messages. The public simulator has visitor and session rate limits. Safety replies no longer claim that staff has already been alerted before delivery is verified.
- Local checks: TypeScript, 699 tests, ESLint and lint budget pass. Vercel Preview and Production builds succeeded. The simulator used the configured Gemini key to route "אפשר אוטו לחופשה?" into rental intake in both preview and production. Accident, human handoff and policy replies were checked on preview. An unsigned production webhook request returned 401 while transport is unset. Real WhatsApp delivery still requires completed YCloud onboarding.
- Remaining delivery caveat: a provider send failure after inbound logging is not durably reprocessed on retry. Before enabling a real number, add a delivery state/outbox or another recoverable processing mechanism and verify it with YCloud test events. Staff SMS alerting requires Twilio configuration and a real test SMS. The public demo now tells visitors that free-text messages may go to Gemini and asks for fictional details.


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

Added a scoped 4-digit PIN login (`WHATSAPP_INBOX_PIN` env var) so
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
started". The current Meta popup supports both Facebook and WhatsApp Business/QR
onboarding. We opened the latter only to inspect its first screen, then closed it.
Daniel must review the simulator and approve before any number is connected.

**Blocked exactly here:** Daniel has not approved linking his number. The faster QR
onboarding path does not require Facebook login or a Meta business portfolio during
the connection, but it does require his WhatsApp Business app and his explicit phone
authorization. Do not submit the number or accept Meta/YCloud terms for him.

**Next session, resume by:**
1. Let Daniel test `https://www.smartcar.co.il/he/whatsapp-demo` and collect his feedback.
   Fix any problems he finds, then wait for his final approval to link the number.
2. Confirm Daniel is available with his primary phone and WhatsApp Business version
   2.24.17+.
3. Go to `https://www.ycloud.com/console/#/app/dashboard/createChannel/whatsapp-business-app`
   (or navigate WhatsApp accounts → Coexistence → Get started again).
4. Choose **Continue with WhatsApp Business** / QR connection. Enter the existing
   business number and complete the business-info screen with the registered legal
   name and `https://www.smartcar.co.il`. Daniel reviews and accepts the terms.
5. When it asks to scan a QR code, Daniel scans it from his WhatsApp Business App (must
   stay open during the process). Confirmed by official docs: this does **not** delete
   anything — chats/contacts stay in the app; up to 6 months of history syncs over.
6. After onboarding, YCloud gives a `waba_id`/`phone_number_id`/API key. Set in Vercel:
   `WHATSAPP_TRANSPORT=ycloud`, `WHATSAPP_YCLOUD_API_KEY`, `WHATSAPP_BUSINESS_PHONE`,
   `WHATSAPP_YCLOUD_WEBHOOK_SECRET`. Register webhook URL
   `https://www.smartcar.co.il/api/whatsapp/webhook` in YCloud's dashboard; the non-`www` host redirects.
7. Test real inbound, app echo, handoff silence, SMS alert and send failure recovery
   before turning on automatic replies for customers. Keep the Business app active;
   YCloud says inactivity or signing into a different device can unlink Coexistence.

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
