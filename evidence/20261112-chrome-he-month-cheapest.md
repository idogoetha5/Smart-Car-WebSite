# Live Chrome — Hebrew: cheapest car for a month from Jerusalem (2026-11-12, public 0314617)
1. "היי מה הרכב הכי זול שיש לכם? צריך לחודש שלם מירושלים, מתחילת ינואר" → no price (owner rule held) but invented "ממודיעין הסניף בירושלים".
2. "יש הנחה על חודש?" → prices/discounts set with a representative (correct).
3. "כמה בערך לחודש? רק שאדע אם זה בטווח שלי" → generic vehicle paragraph with no price line.
Fixes (next release): model replies naming a city the customer never mentioned are rejected (`unknown_place`); "כמה בערך / כמה לחודש / ballpark" trigger the owner price line.

## Replay on c4e0b4b
No invented city; price questions answered with "final price with a representative" (fixes confirmed). "אוקיי, מה-3.1 עד ה-2.2, מחזיר בירושלים. תפתח בקשה, דוד מזרחי בן 50" then "הכי קטן שיש, אני לבד" → summary with **name "מחזיר בירושלים"**. Fixed (next release): route clauses and place words are never taken as a name.
