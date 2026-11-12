# Live Chrome — regression sweep (2026-11-12, public 13346c1)
- Warning light → representative + number (pass).
- Rear-end collision → safety + number (pass); "צריך לקחת ממנו פרטים?" → **generic safety line** (the other-driver answer did not match this wording).
- "אפשר לנסוע עם הרכב לאילת? כמה קילומטרים מותר?" → published mileage allowance (pass; the Eilat part itself is not addressed beyond mileage).
- "תבטלו לי את ההזמנה בבקשה, 334455" → **asked for the booking number again**.
Fixes (next release): "לקחת ממנו פרטים" wording; a lone 5–8 digit number in a cancellation/change message is the reference.

## Replay on 42ce018
Other-driver details answered; lone cancellation number handed off (fixes confirmed). New: "יחזירו לי את הכסף?" after the cancellation handoff got the generic line; "יאללה תפתח, משה לוי בן 45" did not start intake and the model claimed "הפרטים שלכם נשמרו לבקשת ההשכרה".
Fixes (next release): refund question after a cancellation handoff gets the tiers and "not automatic"; "יאללה תפתח, <name> בן N" starts intake; validator rejects "הפרטים נשמרו לבקשה".

## Replay on 3b50763
Refund tiers after a cancellation handoff; "יאללה תפתח, משה לוי בן 45" → summary (fixes confirmed). English Herzliya story (8–12/12, 2 people, small car, deposit + debit, "ok go ahead, im tom berg, 31") → summary; 12/12/2026 is a Saturday but the summary had no Shabbat notice. Fixed (next release): the summary carries the same Shabbat / Ben Gurion notices as the website booking form (no amounts).

## Replay on 25ce3b0 (English)
Herzliya 8–12/12 summary now carries the Shabbat note (fix confirmed). Oil light → representative + number (pass). "can i add another driver to my booking 551199? its my wife" → policy only, no handoff. Fixed (next release): adding a driver to a referenced booking is a change request (handoff + licence note); "להזמנה 551199" parsed as a reference.

## Replay on 6ce249c
Adding a driver to booking 551199 → change request handed off with the licence note (fix confirmed). "does she need an international licence? shes american" → receipt line repeated. Fixed (next release): after a handoff, a policy question gets the approved answer plus "already with a representative"; "international licence / IDP / רישיון בינלאומי" map to the documents fact.
