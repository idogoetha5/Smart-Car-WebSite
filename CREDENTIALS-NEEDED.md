# WhatsApp Bot — Credentials Needed (Phase 0)

Ido is running 360dialog and Twilio signup himself (identity/payment on both, plus the QR step needs Daniel's phone). This is what each env var is, exactly where to get it, and what to report back once it's set.

**Don't paste raw secret values into chat.** Set them directly in `.env.local` for local dev and in the Vercel project's environment variables for deploy. What to report back is called out per item below — it's confirmations and non-secret identifiers, not the secrets themselves.

## 1. 360dialog (WhatsApp sending/receiving)

Do this first — it's the real go/no-go check for the +972 number, per the plan.

1. Go to the [360dialog Hub](https://hub.360dialog.com), sign up, add a payment method.
2. "Add number" → enter 09-9509757 → confirm "Yes, Business App" → this is where Daniel scans a QR code from the WhatsApp Business App on his own phone.
3. Once onboarding completes, the channel's API key is under that number's settings in the Hub.

| Var | Where to get it | What it is |
|---|---|---|
| `WHATSAPP_D360_API_KEY` | 360dialog Hub → the channel (09-9509757) → API key | Authenticates every send/receive call for this number |
| `WHATSAPP_VERIFY_TOKEN` | You make this up — any random string | Only used if 360dialog's webhook setup does a `hub.challenge`-style handshake against our endpoint (unconfirmed — see below). Harmless to set either way. |
| `WHATSAPP_WEBHOOK_SECRET` | Check the Hub's webhook configuration screen for a "signing secret" option once you're onboarding | 360dialog's exact webhook-auth mechanism isn't confirmed yet (see the note in the Phase 1 commit). If the Hub offers a secret/signature option, set it here and tell me what kind (shared secret header vs. HMAC signature) so I can wire the check correctly — this is exactly the "verify at implementation time" item from the plan. If there's no such option, leave this blank. |

**Also from this step**, configure the webhook URL in the Hub to point at `https://<your-production-domain>/api/whatsapp/webhook` once the code is deployed, and subscribe to `messages`, `history`, `smb_app_state_sync`, and `smb_message_echoes`.

**Report back:** whether the number was accepted (the actual +972 eligibility answer), whether the webhook config screen has a signing-secret option (and which kind), and confirm the env vars are set — not the key value itself.

## 2. Twilio (escalation SMS to Daniel)

The second go/no-go check — send Daniel a real test SMS as part of this setup, don't wait for the first live escalation to find out delivery doesn't work.

1. Sign up at [twilio.com](https://www.twilio.com), add a payment method.
2. Console dashboard home page has an "Account Info" panel with your Account SID and Auth Token (click "reveal" for the token).
3. Phone Numbers → Buy a Number → pick any number with SMS capability (a standard numeric long code — don't buy anything alphanumeric, that needs ~1 week of Israeli pre-registration we're deliberately avoiding).

| Var | Where to get it | What it is |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Console dashboard → Account Info panel | Identifies your Twilio account |
| `TWILIO_AUTH_TOKEN` | Same panel, click to reveal | Authenticates API calls — treat like a password |
| `TWILIO_FROM_NUMBER` | The number you buy, in `+1XXXXXXXXXX` (or whatever country) E.164 format | The "from" for every escalation SMS |
| `DANIEL_ALERT_PHONE` | Daniel's personal mobile, E.164 format e.g. `+9725XXXXXXXX` | Where escalation alerts land. Can be the same physical phone as the WhatsApp Business App — SMS is a separate channel, this doesn't conflict with anything on the WhatsApp side. |

**Report back:** confirm the test SMS actually arrived on Daniel's phone (that's the real check, not just that Twilio's API returned success), and confirm the env vars are set.

## 3. Anthropic (the AI replies)

| Var | Where to get it | What it is |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key | Authenticates the Claude calls that generate replies |

**Report back:** confirm it's set. Nothing else needed here — no signup complexity like the other two.

## Once everything above is set

Tell me the env vars are in place (in `.env.local` and in Vercel) and I'll run the live verification list from the plan: a real inbound message, a booking-matched reply, idempotency on a replayed webhook, the silence rule after Daniel replies from his phone, a triggered escalation with a confirmed-delivered SMS, and the kill switch.
