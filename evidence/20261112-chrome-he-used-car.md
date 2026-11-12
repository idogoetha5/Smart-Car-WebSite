# Live Chrome — Hebrew used-car purchase (2026-11-12, public 03724e9)
1. "היי ראיתי שאתם מוכרים רכבים משומשים, יש לכם משהו משפחתי עד 80 אלף?" → budget 80,000 understood; but "יש לנו מבחר רכבים משומשים" (unverified stock claim).
2. "עדיף היברידי, לא יותר מ100 אלף קמ" → preferences restated correctly; offered to "hear about specific models" (the bot cannot list stock).
3. "אפשר לבוא לראות מחר?" → honest (viewing subject to availability), offer of a representative.
Fixes (next release): validator stock_assurance covers "יש לנו מבחר/מגוון/רכבים" and "we have a range of cars"; purchase questions about what is available or viewing get the published cars-for-sale page link.

## Replay on d4441bb
Link to /cars-for-sale shown (fix confirmed) but repeated on the next turn; model wrote "אפשר בה בהחלט". "כן שמישהו יחזור אליי" → handoff with number. Fixed: link not repeated within the last turns; "בה בהחלט" cleaned.
