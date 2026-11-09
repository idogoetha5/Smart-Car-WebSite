# Chrome live — casual Hebrew family rental to the Galilee (2026-11-09, public 7ae01c5)

1. "היי אנחנו זוג עם 2 ילדים קטנים, צריכים רכב לחופשה בגליל" → family advice; **passengers stored as 2** (should be 4).
2. "מהרצליה, מה 15.12 עד ה 19.12. צריך שני כיסאות בטיחות אחד לתינוק ואחד לבן 4" → dates and pickup stored; **child seats stored as 1**; model said "רשמתי את ההזמנה" (no booking exists).
3. "רגע בעצם את הבוסטר של הגדול נביא מהבית, רק כיסא אחד לתינוק. ועגלה נכנסת במשפחתי?" → seat change acknowledged (1), conditional stroller answer; **no next question** (return place missing) — stalls.
4. "להחזיר גם בהרצליה. יאללה בואו נתקדם, דנה בדיקה, נהג ראשי בעלי בן 38" → return and 24+ stored, intake started, **name not kept** → "על איזה שם לרשום את הבקשה?" (FAILED).

Repairs: couple/two adults/me-and-my-partner + N children = 2+N (HE/EN); a count before "כיסאות בטיחות" is the total, a number after it a per-child breakdown; validator rejects "רשמתי את ההזמנה / I've booked"; an explore draft with dates+pickup and no question asks the missing return place; after an explicit start a standalone two-word clause is the name (driver/relationship words excluded). Tests added.

## Replay on 8c03a3e
- Passengers 4, seats 2 then 1 after the booster change, name "דנה בדיקה" and 24+ kept; reached summary, simulated consent and a correct seat recall. 
- Still failed twice before that: "מה 15.12 עד ה 19.12" not parsed locally (asked the date again) and "להחזיר גם בהרצליה" not stored (asked the return place again); the model also said "רשמתי איסוף והחזרה" with no return saved.
- Repairs: spaced Hebrew/English numeric ranges ("מה 15.12 עד ה 19.12", "from the … to the …"), "להחזיר גם ב…" with trailing fillers trimmed, partial route/date claims rejected when that leg is unsaved. Tests added.
