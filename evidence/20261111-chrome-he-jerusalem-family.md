# Live Chrome — Hebrew family rental from Jerusalem (2026-11-11, public be627d1)

Fictional customer, casual Hebrew:
1. "אהלן צריך 7 מקומות מחר בבוקר מירושלים לשלושה ימים, אנחנו זוג עם 4 ילדים" — state: 6 passengers, 12–15/11, Jerusalem pickup, seven-seater. Reply claimed "רשמתי בקשה" (no request existed) and "באיסוף ודאי".
2. "יש לכם כיסא לתינוק? הקטן בן שנה" — 1 child seat stored. Reply: "ממירושלים" typo; generic closing question instead of the missing return place.
3. "וכמה זה יוצא בערך?" — owner price rule held (no amount).
4. "סבבה תפתח לי בקשה, אני משה כהן" — intake started, but the name was not captured.
5. "לאותו מקום, ירושלים" → return stored; "אני בן 38" → 24+; then the bot asked for the name again.

Fixes (next release): validator rejects "רשמתי/רשמנו בקשה"; "ממירושלים" cleaned; with route known except the return place, a generic closing question is replaced by the return question; Hebrew self-introduction ("אני משה כהן", "שמי דנה לוי") is taken as the name during intake, excluding ages/roles/verbs. Tests: `whatsapp-owner-rules-20261109.test.ts` ("jerusalem family rental").

## Replay on 30f369d (different wording)
"…מירושלים, מה-18.11 לארבעה ימים. אנחנו 2 מבוגרים ו3 ילדים" → dates 18–22/11 and Jerusalem correct, return place asked directly (fix confirmed), but passengers stored as 2. "לירושלים חזרה. יש לכם כיסא בוסטר?" → return stored, booster not stored. "כן בוא נתקדם. אני רונית אברהם, בת 41" → summary with name and 24+. "רגע אנחנו 5 לא 2, ותוסיף בוסטר אחד" → passengers corrected to 5, booster still missing.
Fixes (next release): Hebrew "N מבוגרים ו־M ילדים" counts adults+children; "יש לכם … בוסטר" and "תוסיף בוסטר אחד" / "add one booster seat" store a seat.
