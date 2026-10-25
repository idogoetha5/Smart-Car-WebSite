# SmartCar bot: conversation contract

This is the acceptance contract for the replacement conversation core. It does
not authorise customer WhatsApp traffic. The existing webhook signature checks,
message log, human-silence rule, outbound sender and transport kill switch stay
in place.

## What the bot knows

- The current customer message, recent turns and facts the customer actually
  supplied. A correction replaces the earlier value; an unanswered question
  does not create a booking fact.
- Published SmartCar service terms, branches and vehicle groups. A catalogue
  listing is not live inventory or a confirmed vehicle assignment.
- An existing booking only when the authenticated phone lookup returns one.

The bot does not know live availability, a final price, a vehicle's exact cargo
or child-seat fit, a customer's insurance eligibility, or the outcome of a staff
decision until a system of record confirms it.

## What the bot may do

1. **Explore:** ask about the trip, recommend one suitable SmartCar direction
   with the reason, and offer one practical next step. Exploration is not
   consent to make a request. Do not compare, recommend or name taxis, public
   transport or competitors in the reply, even if the customer does.
2. **Collect a rental request:** only after an explicit wish to proceed. Keep
   supplied dates, locations, vehicle needs, name and email. Ask only for the
   next missing item. Show the complete summary and ask for explicit final
   confirmation before creating a request. Report creation only after the
   database action succeeds. Never claim that a request is a confirmed booking.
3. **Service:** answer published general terms, use the actual booking where
   available, and escalate case-specific changes, disputes, refunds and
   decisions that require staff. A handoff is reported only when the handoff
   action and alert are recorded. Never turn a service problem into a sale.
4. **Safety:** accident, unsafe vehicle and breakdown reports bypass sales
   generation. Give immediate safe steps and the verified SmartCar number;
   request human attention. Do not promise a tow, replacement or coverage.
5. **Failure:** if Gemini is unavailable or returns unusable content, answer
   from a bounded local service/recommendation path and retain the state. Do
   not silently change to another model or retry a business action.

## Gemini boundary

The approved customer model is Gemini 3.5 Flash-Lite. A separate full-admin
rehearsal may compare Gemini 3.8 Flash; it cannot change the customer model.
Gemini may infer intent, extract facts with direct customer evidence and draft
one short reply. Application code owns state transitions, consent, service
actions and safety routing. Name, email, phone, booking reference, payment data
and exact street address do not go to the model. The model's own memory is not
evidence of a customer fact.

## Acceptance

Check complete independent 6–10-turn real-model dialogues across family,
tourist, city trip, longer rental/leasing, business, young driver, ready buyer,
indecision, existing service, corrections, topic changes and the site's entry
messages. Review the actual final reply, source, state and next step each turn.
Repeat every observed failure on the rebuilt candidate. Verify provider outage
and recovery, request idempotency and human takeover. Customer WhatsApp stays
OFF until the owner separately approves phone coexistence and launch.
