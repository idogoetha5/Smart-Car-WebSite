# Live Chrome — English tourist at Ben Gurion (2026-11-12, public d4441bb)
1. "hi! landing at ben gurion dec 4 at 11pm, need a small car till dec 10, returning at the airport too" → compact suggested, but asked "Where would you like to pick it up?" (arrival not taken).
2. "what happens if my flight is late? and is there an extra charge for the airport?" → **wrong**: "There is no separate public branch fee for airport collection" — the website publishes a ₪150 airport surcharge (booking notices, airport page).
3. "ok lets do it. sarah cohen, 27" → asked the pickup place again.
Fixes (next release): approved fact `airport_fee` (₪150, not in the website estimate, 24/7 by arrangement, final price with a representative); validator `fee_denial` rejects "no separate fee / free of charge / ללא תוספת"; "landing at ben gurion" / "נוחתים בנתב״ג" is the pickup and "returning at the airport" / "נחזיר גם בנתב״ג" the return.

## Replay on b7f1568
Arrival and return at the airport stored (fix confirmed); surcharge answered correctly (₪150, final price with a representative). Still: the late-flight part was not answered, and "ok lets do it. sarah cohen, 27" did not start intake — the model claimed a representative "will finalise the request".
Fixes (next release): late-flight sentence (tell SmartCar to rearrange the handover, no promise); "ok lets do it. <first last>, <age>" starts intake; validator rejects "will finalise/complete/confirm the request".

## Replay on 501c128
Late flight answered; surcharge correct; "ok lets do it. sarah cohen, 27" started intake (fix confirmed) but asked the age group although 27 was given. Fix (next release): "<first last>, NN" sets the driver age.
