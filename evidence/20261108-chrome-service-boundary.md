# Chrome service boundary and provider proof — 8 November 2026

Version ec9ac49, READY dpl_J5skCDM1GZLAxCHUM35pQCEepkbF with public aliases; GitHub CI42465946103SUCCESS. Human-style English existing-rental story, native Chrome public demo. **FAIL** at turn3; no real request, message or booking was created. Simulation reset started the new business story, retaining the ordinary rate-limit session.

## Provider proof, not merely varied wording

Before turn1, opened Chrome DevTools Network via native UI. The actual simulator request showed HTTP200; Preview explicitly displayed `source: "gemini"`, `model: "gemini-3.5-flash-lite"`, `escalated: false`, phase service and the visible reply. No console execution, header injection, direct simulator HTTP call or private debug mode was used. This proves a real Gemini response after the earlier HTTP400 outage; it does not prove every later turn or customer WhatsApp delivery. No recovery email was assumed; a successful response on a fresh deployment need not have an existing per-instance circuit to trigger ai_recovered.

## Conversation

1. Customer: Hi, I've got one of your cars until tomorrow but my work meeting just moved. I'm trying to work out whether to keep it another night or give it back and get another one later. I haven't decided, please don't change anything yet.

Bot: Keeping the car another night requires prior approval and availability, and extra days may have a different rate. Our team is happy to check extension options for you when you are ready.

2. Customer: So if nobody gets back to me before tomorrow, do I just hang on to it? I'm in meetings all morning and might not see my phone. Also would the extra night cost the same as the days I've already paid for?

Bot: No, you should not assume permission to keep the car. The original return deadline remains binding until an approved extension is confirmed, and extra days may have a different rate rather than the original daily price. When you are free, let us know and we will be happy to check availability and extension options for you.

3. Customer: Okay, don't arrange a call yet. My colleague might drive it back for me instead. He's 25 but wasn't on the paperwork when I collected it. Can he just bring it back if I give him the keys, or does that cause a problem?

Bot: What date would you like to pick up the car?

4. Customer: I already have the car, I'm not picking up another one. I'm asking whether my colleague can return the one I'm using. I haven't chosen an extension or asked you to book anything.

Bot: What date would you like to pick up the car?

5. Customer: This is about my existing booking. My question was about an additional driver, not new rental dates. Please answer that first.

Bot: What date would you like to pick up the car?

## Diagnosis and repair awaiting acceptance

An affirmative prefix after an offer to check extension availability was treated as acceptance of a new-rental invitation before Gemini could read the current service question. Once in intake, phase precedence trapped even explicit existing-booking corrections. Implicit new-rental invitation acceptance is now excluded in service; explicit separate new rentals remain allowed. Explicit existing-rental corrections can leave a mistakenly started intake without approving any action or discarding the draft. Uncertainty wording in both languages prevents a change request solely from mentioning extension. Controlled tests cover prevention, escape, no creation/escalation and explicit new-rental positive control. Full live service acceptance still required.

## Rental correction spot-check before this new story

Continued the preserved failed Hebrew rental on ec9ac49 with: “אני מחזיר בהרצליה, ביום חמישי. בבקשה תתקן את המקום בסיכום”. Summary corrected return location from חמישי to הרצליה while keeping family car, 09/11–12/11, pickup Herzliya, main age24+ and the fictional name. “אני מאשר” produced simulation-only receipt. This is a cross-version repair spot-check, not a fresh full-story pass.

Follow-up “רק לוודא, באיזה יום ומקום אני מחזיר בסוף? וכבר יש לי רכב סגור או שעוד מחכים להצעה?” correctly denied confirmed car but omitted the asked day/place. Natural completed-route questions now include the retained route/date receipt; fresh live recheck pending.
