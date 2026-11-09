# Chrome live — mandatory "car in the garage" replay (2026-11-09, public 72cd92a)

Exact five handoff messages, then natural continuation.

1–3: model answers (replacement while own car is in the garage; two days then extend subject to approval; additional driver must be registered). Price ballpark asked twice, not given (no approved range). Odd Hebrew "לקצובת ימים".
4. "מחר כמו שאמרתי 🙂 בוא נלך על קטן ליומיים, מהרצליה ולהחזיר שם. רגע אשתי בת 23 ואני 31…" → **state correct**: 10/11–12/11, הרצליה both ways, קומפקטי, main driver 24+. Reply ended "האם נשריין את הרכב…?" (reservation wording).
5. "כן יאללה. קוראים לי איתי בדיקה…" → name captured, but **FIRST FAILURE**: local reply asked again "תרצו שנתחיל בקשה…?"; intake not started.
6. "אמרתי כן 😅" → model: "נעדכן את הבקשה…" while still explore/menu — no request exists.

Cause: the reserve-worded offer was not recognised as an invitation; "אמרתי כן" not accepted.
Local repair: reserve/hold offers count as an invitation to prepare a request; "אמרתי כן"/"I said yes" accepts; the validator rejects reservation wording (נשריין / reserve the car). Tests added (3).

## Recheck on bf710b4 (same five messages, then natural continuation)

- Turn 5 now shows a correct full summary: compact, 10/11–12/11, הרצליה both ways, main driver 24+, name. **The handoff's mandatory replay passes turn 5.**
- Turn 6 "רגע לפני שאני מאשר … להחזיר בשישי במקום? ומה עם המחיר אני לא רוצה הפתעות" → return updated to 13/11 correctly, but the model promised "התעריף המקורי, בלי הפתעות" → validator now rejects price promises.
- Turn 7 "אוקיי אני מאשר" → **FAILED**: summary shown again; final consent required an exact "מאשר". Turn 8 a follow-up got the summary again; turn 9 bare "מאשר" sent it.
- Repair: final consent accepts a short casual lead/courtesy tail ("אוקיי אני מאשר", "סבבה, מאשרת 👍", "ok I confirm") and still refuses negation, extra changes or questions. Tests added.
- Other wording seen: "כשאורזים את הרכב למוסך" (nonsense), "גילאי 31 ו־23 מתאימים" (eligibility overstatement for 23 — open).
