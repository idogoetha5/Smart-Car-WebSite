# WhatsApp Bot — Credentials Needed

**Status on 15 Oct 2026: YCloud Coexistence is the selected onboarding path.** It keeps the business number in the WhatsApp Business App on the owner's phone while the SmartCar bot works through the official API. The code has local tests, but the real YCloud channel is not yet connected. Complete the live preview and delivery checks before connecting 09-9509757.

**Daniel reviews first:** `https://www.smartcar.co.il/he/whatsapp-demo` is a public simulation with fictional details. It does not connect the business number or send WhatsApp messages. Do not start Meta signup, register a webhook, or enable the transport until Daniel gives final approval. The Meta popup was closed before any number, terms acceptance, or QR authorization.

The YCloud account is ready. We will first perform the complete local test suite. Then, if a spare WhatsApp Business number is available, use it for the live connection rehearsal before connecting the business number.

The existing number should be connected only through the **WhatsApp Business App Coexistence** option—never the ordinary API-number migration option.

**Don't paste raw secret values into chat.** Set them in `.env.local` for local dev and in the Vercel project's environment variables for deploy.

---

## Chosen path: YCloud Coexistence (free plan, owner keeps the phone app)

YCloud is an official Meta WhatsApp Business Solution Provider. The account currently shows a Free plan, but its dashboard says that from 1 Oct 2026 service messages are billed at Utility rates after 1,000 free service messages per phone number per month. Check current charges in YCloud before enabling a real number.

When the local test checklist is complete:

1. After Daniel approves, in YCloud select **Create Channel** → **WhatsApp Business App Coexistence** → **Get started**.
2. Choose **Continue with WhatsApp Business** / the QR connection path. According to YCloud's [current guide](https://docs.ycloud.com/en/documentation/channels/whatsapp-accounts-management/coexistence/onboard-whatsapp-business-app), this path does not require Facebook login or a Meta business portfolio during connection. The separate Facebook path does. Enter the existing Business App number, the exact registered legal business name, and `https://www.smartcar.co.il`; Daniel reviews and accepts the displayed terms.
3. Daniel opens the existing WhatsApp Business App (version 2.24.17 or newer) on the primary phone and scans the QR code shown by Meta/YCloud to authorize the link.
4. Daniel chooses whether to share up to six months of chat history, and keeps the app open until synchronization finishes. He continues answering customers in that app. His phone replies are mirrored to the API as `whatsapp.smb.message.echoes`; after a representative reply, SmartCar's bot pauses that customer's conversation for 24 hours, except a new emergency safety reply. Verify this with a real message before enabling customer traffic.
5. In YCloud Developers → Webhooks, create an endpoint at the canonical URL `https://www.smartcar.co.il/api/whatsapp/webhook` (the non-`www` host redirects) and subscribe only to:
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

After the scan, keep the WhatsApp Business App installed and active. YCloud says prolonged app inactivity or signing into a different device can unlink Coexistence. The bot cannot notify Daniel of a handoff by SMS until the Twilio settings below are configured and a real SMS has been received. Also resolve the webhook's send-failure retry caveat in `WHATSAPP_BOT_STATUS.md` before enabling the business number.

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

Before testing the current bot, run `database/migrations/add-whatsapp-tables.sql` in the
Supabase SQL Editor. It now also creates `whatsapp_conversation_states`, which
stores a short-lived (30 minute) rental-intake state. Customers can complete a
request entirely in WhatsApp in Hebrew or English: dates and times, locations,
vehicle category, name, email, review and explicit terms acceptance. Completed
requests are stored in `whatsapp_rental_requests`. They are not confirmed
bookings, prices or specific vehicles until a representative checks the full
fleet and confirms the details in writing.
