# WhatsApp Bot — Credentials Needed

**Status: YCloud Coexistence is the selected onboarding path.** It keeps the business number in the WhatsApp Business App on the owner's phone while the SmartCar bot works through the official API. The bot is prepared for YCloud locally, but **do not create a WhatsApp channel or touch 09-9509757 until the final local checks are complete.**

The YCloud account is ready. We will first perform the complete local test suite. Then, if a spare WhatsApp Business number is available, use it for the live connection rehearsal before connecting the business number.

The existing number should be connected only through the **WhatsApp Business App Coexistence** option—never the ordinary API-number migration option.

**Don't paste raw secret values into chat.** Set them in `.env.local` for local dev and in the Vercel project's environment variables for deploy.

---

## Chosen path: YCloud Coexistence (free plan, owner keeps the phone app)

YCloud is an official Meta WhatsApp Business Solution Provider. Its free plan supports the API and webhooks; standard replies during a customer-initiated service window are free. Meta may charge for approved proactive template messages later—this bot does not send those in Phase 1.

When the local test checklist is complete:

1. In YCloud, select **Create Channel**.
2. Select **WhatsApp Business App Coexistence** (not a new API number).
3. The owner opens the existing WhatsApp Business App on the primary phone and scans the QR code shown by YCloud.
4. Choose chat sharing so both customer replies and the owner's replies are synchronized. The owner keeps using the app normally.
5. In YCloud Developers → Webhooks, create an endpoint at `https://<domain>/api/whatsapp/webhook` and subscribe only to:
   - `whatsapp.inbound_message.received`
   - `whatsapp.smb.message.echoes`
   - `whatsapp.message.updated`
6. Save the YCloud API key and the webhook endpoint secret directly in the deployment settings—never in chat.

| Var | Where to get it |
|---|---|
| `WHATSAPP_TRANSPORT` | Set to `ycloud` |
| `WHATSAPP_YCLOUD_API_KEY` | YCloud Developers → API Keys |
| `WHATSAPP_BUSINESS_PHONE` | The connected business number, e.g. `+97299509757` |
| `WHATSAPP_YCLOUD_WEBHOOK_SECRET` | The secret generated for the YCloud webhook endpoint |

After the scan, keep the WhatsApp Business App installed and open it at least once every two weeks. The owner can respond from the phone at any time; YCloud emits `whatsapp.smb.message.echoes`, and the bot automatically pauses that customer conversation for 24 hours (except a new accident/breakdown safety message).

---

## Fallback A: 360dialog (Coexistence, paid)

Kept in code only as a fallback. Do not select it unless the YCloud route proves unsuitable.

## Path B: Direct Meta Cloud API (irreversible, free)

No middleman, no monthly fee — but migrating 09-9509757 here permanently deletes that number's WhatsApp Business App chat history, groups, and status (confirmed via Meta's migration docs). **This is the one-way door — only run this against the real business number once Daniel's inbox test has actually succeeded, not before.**

**Before migrating the real number** (not needed for the test-number version): back up Daniel's chat history — [Android](https://faq.whatsapp.com/744445782709185/?helpref=faq_content) / [iOS](https://faq.whatsapp.com/180225246548988/).

1. [business.facebook.com](https://business.facebook.com) → Business Manager account, start business verification in parallel (not blocking — 250 msgs/24h unverified limit covers real volume — but slow, days to weeks).
2. [developers.facebook.com](https://developers.facebook.com) → Create App → add the WhatsApp product → connect/create the WABA.
3. Business Settings → System Users → create one, assign the app + WABA, generate a permanent token (`whatsapp_business_messaging`, `whatsapp_business_management`).
4. For a **test number**: Meta auto-provisions one in API Setup — add your own number as a verified test recipient, done, no phone-side steps.
   For the **real number** later: on Daniel's phone, WhatsApp Business App → Settings → Account → Delete my account → wait ~3 min → register 09-9509757 in API Setup.
5. Webhook: point at `https://<domain>/api/whatsapp/webhook`, set a Verify Token, subscribe to `messages`. Note the App Secret (App Dashboard → Settings → Basic).

| Var | Where to get it |
|---|---|
| `WHATSAPP_TRANSPORT` | Set to `meta_direct` |
| `WHATSAPP_ACCESS_TOKEN` | Step 3 — system user token |
| `WHATSAPP_PHONE_NUMBER_ID` | Step 4 — the number's entry in API Setup |
| `WHATSAPP_APP_SECRET` | App Dashboard → Settings → Basic |
| `WHATSAPP_VERIFY_TOKEN` | You make this up — any random string |

---

## Twilio (escalation SMS to Daniel) — needed regardless of path

1. [twilio.com](https://www.twilio.com), sign up, add payment.
2. Console dashboard → "Account Info" panel → Account SID + Auth Token (reveal).
3. Phone Numbers → Buy a Number → any SMS-capable numeric long code (not alphanumeric — that needs ~1 week of Israeli pre-registration).

| Var | Where to get it |
|---|---|
| `TWILIO_ACCOUNT_SID` | Console dashboard |
| `TWILIO_AUTH_TOKEN` | Console dashboard, reveal |
| `TWILIO_FROM_NUMBER` | The number you buy, E.164 |
| `DANIEL_ALERT_PHONE` | Daniel's personal mobile, E.164 |

**Report back:** confirm a real test SMS arrived on Daniel's phone.

## Once you have a test connection running (either path, test number)

Tell me it's set up and I'll walk through the live verification list with you: a real inbound message receiving the deterministic service menu, a booking-matched reply, the accident and roadside-help paths, and — the actual point of this phase — Daniel using `/admin/inbox` for a couple of days on real conversations. Claude is deliberately disconnected from the webhook.

## Guided service flow

Before testing the current bot, run `scripts/add-whatsapp-tables.sql` in the
Supabase SQL Editor. It now also creates `whatsapp_conversation_states`, which
stores a short-lived (30 minute) rental-intake state. Customers can complete a
request entirely in WhatsApp in Hebrew or English: dates and times, locations,
vehicle category, name, email, review and explicit terms acceptance. Completed
requests are stored in `whatsapp_rental_requests`. They are not confirmed
bookings, prices or specific vehicles until a representative checks the full
fleet and confirms the details in writing.
