# Live Chrome — Hebrew/English mix, changes of mind (2026-11-12, public c5aba0f)
1. "אהלן צריך רכב SUV להרצליה מ 10/12 עד 14/12 bro" → dates + SUV stored; **"רשמתי את בקשתכם"** (no request existed).
2. "בעצם תעשה משפחתי זה יותר זול לא?" → **vehicle stayed SUV**; no price comparison (correct).
3. "אוקי ואם אני רוצה להחזיר בירושליים במקום?" → return in Jerusalem possible (fine).
4. "כן נחזיר בירושלים. רועי אזולאי בן 26 תסגור" → **no intake**; model claimed the request was recorded and would be approved.
Fixes (next release): validator covers "רשמתי את בקשתכם/הזמנתכם"; vehicle changes with "בעצם / תעשה / תשים / עדיף / make it / switch to"; "תסגור" ends a go-ahead and is stripped from the name clause.
Open: "רכב להרצליה" stays ambiguous (to or from Herzliya), so the bot asks for the pickup place.

## Replay on 33f65c4
Vehicle switch to family, no "recorded" claim, "תסגור" → full summary (fixes confirmed). Model added "על החזרה בסניף שונים עשויה לחול תוספת" (no one-way fee is published) → validator `fee_claim` (next release).
