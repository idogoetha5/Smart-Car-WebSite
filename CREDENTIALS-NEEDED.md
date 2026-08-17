# WhatsApp Bot — Credentials Needed

**Status: onboarding path undecided.** Both the 360dialog/Coexistence path and the direct-Meta path are implemented and kept live in the code (`WHATSAPP_TRANSPORT` env var picks which one runs). Ido is running a cheap 2-3 day test first — Daniel working real conversations through a minimal web inbox (`/admin/inbox`, no PWA, no push yet) — before committing to either path for real. **Do not touch 09-9509757 or run either onboarding path against it until that test decides something.**

For the cheap test itself, connect *either* path to a throwaway/test number, not the business number:
- **Fastest for a quick test**: Meta gives you a free test phone number automatically when you create a WhatsApp app in the developer console — no real number, no migration, works immediately for phone numbers you add as verified test recipients. That's probably the path of least effort just to see the inbox UI working end to end.
- Or point 360dialog's sandbox/trial at a spare number if that's easier for you.

Once Daniel's test settles which path SmartCar actually commits to, only that section below matters — the other stays as reference in case the decision reverses.

**Don't paste raw secret values into chat.** Set them in `.env.local` for local dev and in the Vercel project's environment variables for deploy.

---

## Path A: 360dialog (Coexistence — reversible, €49/month)

Keeps 09-9509757 live in the WhatsApp Business App on Daniel's phone *and* on the API simultaneously. Reversible — if it doesn't work out, deregister and nothing was lost.

1. [360dialog Hub](https://hub.360dialog.com), sign up, add payment.
2. "Add number" → the real go/no-go check for +972 happens here → confirm "Yes, Business App" → Daniel scans a QR code from the WhatsApp Business App.
3. Channel's API key is under that number's settings once onboarding completes.

| Var | Where to get it |
|---|---|
| `WHATSAPP_TRANSPORT` | Set to `360dialog` |
| `WHATSAPP_D360_API_KEY` | 360dialog Hub → the channel → API key |
| `WHATSAPP_VERIFY_TOKEN` | You make this up — any random string |
| `WHATSAPP_WEBHOOK_SECRET` | Check the Hub's webhook config screen for a signing-secret option — their exact scheme isn't confirmed; if there's an option, tell me what kind so I can wire the check correctly. If none, leave blank (the webhook still runs, just unverified — flagged loudly in the logs). |

Webhook URL: `https://<domain>/api/whatsapp/webhook`, subscribe to `messages`, `history`, `smb_app_state_sync`, `smb_message_echoes`.

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

## Anthropic (the AI replies) — needed regardless of path

| Var | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |

---

## Once you have a test connection running (either path, test number)

Tell me it's set up and I'll walk through the live verification list with you: a real inbound message getting an AI reply, a booking-matched reply, and — the actual point of this phase — Daniel using `/admin/inbox` for a couple of days on real conversations.
