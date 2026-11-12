# Live Chrome — English used-car purchase with financing (2026-11-12, public 39764b1)
1. "hey do you sell used cars? looking for a hybrid under 90k shekels" → "What kind of car would you like to buy?" (no listing link).
2. "do you do financing?" → **"Yes, we offer financing options"** (not published) and the enquiry switched to leasing.
3. "ok have someone call me, im noa" → handoff, but worded as a leasing enquiry.
Fixes (next release): "do you sell / for sale / used cars" gets the /cars-for-sale link; validator `financing_claim`; a purchase enquiry stays a purchase when financing is asked (leasing only when named).

## Replay on 4e0852b
Listing link shown; handoff worded as a purchase (fixes confirmed). Model still wrote "Yes, financing options can be discussed…". Fixed (next release): financing/payment-plan questions on a purchase get fixed honest wording and an offer of a representative.
