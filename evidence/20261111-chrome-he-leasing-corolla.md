# Live Chrome — Hebrew private leasing, Corolla hybrid (2026-11-11, public bf2f85d)
1. "היי כמה עולה ליסינג פרטי על קורולה היברידית ל3 שנים?" → no price given (owner rule held); term 36 stored; model name not stored.
2. "אני עושה בערך 20 אלף קמ בשנה" → mileage 20,000 stored, but reply read "20, לשנה" and asked a generic question.
3. "יש אפשרות בלי מקדמה?" → honest (set in the offer with a representative), but still no step towards the representative.
Fixes (next release): named model kept in commercial memory (`vehicleModel`, shown to the representative as "דגם מבוקש"); validator rejects broken figures like "20, לשנה"; with term, mileage and vehicle known, a trailing generic question becomes the offer to pass details to a SmartCar representative ("כן" then hands off).
