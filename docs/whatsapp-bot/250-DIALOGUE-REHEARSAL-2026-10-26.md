# 250 complete conversation rehearsals — 26 October 2026

The repeatable suite is `src/lib/__tests__/whatsapp-rebuild-250-dialogues.test.ts`.
It sends successive customer messages through the production conversation core,
retains state between turns, and verifies the final action. It uses fictional
details and an isolated in-memory request store. Half the cases include a
mocked model reading and half exercise the deterministic fallback. The mocked
reading is deliberately not a Gemini accuracy measurement.

| Conversation | Cases | Completion checked |
| --- | ---: | --- |
| Rental | 50 | Dates, pickup/return, vehicle, required driver-age group, name/email, explicit consent, exactly one simulated request and handoff |
| Advice to rental | 50 | Consultation stays advisory until requested, then intake reaches consent and a simulated request |
| Leasing | 50 | Price question answered, customer approval reaches the commercial representative, later follow-up does not restart intake |
| Purchase | 50 | Preferences and budget retained, availability question answered without an invented car, approval reaches the commercial representative |
| Existing service or roadside incident | 50 (25 each) | Cancellation/reference, changes and complaints reach service; accidents receive safety guidance and roadside contact without duplicate escalation |

Inputs vary by opening, locale/model path, future date, branch pairing and
driver-age group. The initial run failed ten cases: five purchase scenarios had
not supplied the type/budget the bot was asking for before a generic “yes”,
and five dirty-car complaints were not recognized when phrased “the car I rented
is dirty”. The test scenarios now supply the missing purchase preferences, and
the dirty-car wording is recognized as a service issue. A later variation run
also caught an overly strict test expectation about how “נתבג” is displayed;
the summary preserves the customer-entered spelling. All 250 scenarios pass.

This is a conversation-core rehearsal, not 250 calls to Gemini or WhatsApp.
It verifies final simulated actions, not YCloud delivery, operator inbox
receipt, real stock, an accepted quote, or zero errors in arbitrary language.
Keep the customer-traffic kill switch off until the owner accepts the live
conversation and transport checks, and Daniel completes the phone connection.

## Owner phone transcript found a gap after this pass

The owner supplied an actual demo transcript: solo-car advice, `25/11-16/1`,
“תל אביב גם להחזיר גם לאסוף”, a repeated recommendation question, and “לא
יודע”. A live Gemini-backed simulator run reproduced the repeated vehicle-type
question. The initial 250 conversations did not cover facts supplied during
consultation before booking consent. Three additional regression cases now
exercise the sequence through a completed simulated request, using both local
and model-reading paths. The core must retain facts without treating advice as
booking consent, answer the recommendation and uncertainty, and advance only
when the customer explicitly accepts preparing the request. No claim of 100%
coverage follows from a passing suite.

## 27 October — real Gemini simulator review

Fifteen different public-demo sessions (122 customer turns, 60 Gemini readings)
were run against the production site with fictional details. Every simulated
request/handoff reached an end state, and the API returned no HTTP failures.
Manual review still found visible faults: generic replies to a leasing
inclusions question and an up-front-payment question, repeated sale type and
options questions, a leasing-to-rental switch that stayed on leasing, a vehicle
correction interpreted as a city, baggage counts asked again after they were
given, a compact-car question answered with another date prompt, and generic
replies to a billing complaint or roadside location. The live transcript is
saved outside the release tree at `/tmp/smartcar-live15-results.jsonl` for this
session. Targeted regression tests were added, and the fixes require a fresh
live replay before they count as verified in production. The 250 synthetic
dialogues were useful for state transitions, not for judging naturalness.
