# Live Chrome — Hebrew private leasing, Corolla hybrid (2026-11-11, public bf2f85d)
1. "היי כמה עולה ליסינג פרטי על קורולה היברידית ל3 שנים?" → no price given (owner rule held); term 36 stored; model name not stored.
2. "אני עושה בערך 20 אלף קמ בשנה" → mileage 20,000 stored, but reply read "20, לשנה" and asked a generic question.
3. "יש אפשרות בלי מקדמה?" → honest (set in the offer with a representative), but still no step towards the representative.
Fixes (next release): named model kept in commercial memory (`vehicleModel`, shown to the representative as "דגם מבוקש"); validator rejects broken figures like "20, לשנה"; with term, mileage and vehicle known, a trailing generic question becomes the offer to pass details to a SmartCar representative ("כן" then hands off).

## Replay on 25e3610 (Tucson, 4 years)
"…טוסון ל4 שנים, כמה זה בחודש?" → no price line at all; "בערך 15 אלף בשנה" not taken (asked mileage again); "כן תעביר" → asked budget instead of handing off.
Fixes (next release): owner price line for leasing/sale price questions; a bare "N אלף (בשנה)" / "15k" after a mileage question is the annual mileage; "כן תעביר" / "pass them on" accepts the representative offer.

## Replay on 6832c25
Mileage "בערך 15 אלף בשנה" stored (fix confirmed); model name טוסון kept. Still: no price line on the first turn (the reply said "הצעה"); the model offered "האם תרצו שנחזור אליכם עם הצעה מפורטת?" and "כן תעביר" got a model promise ("נציג … ויחזור אליכם") without a real handoff.
Fixes (next release): price-line check looks only for explicit price wording; "שנחזור/שיחזרו אליכם" counts as the representative offer; validator rejects "ויחזור אליכם עם/בהקדם…" promises.
