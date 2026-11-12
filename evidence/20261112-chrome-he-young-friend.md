# Live Chrome — Hebrew: 22-year-old driver and a friend (2026-11-12, public 22edfad)
1. "אהלן אני בן 22, אפשר לשכור אצלכם? צריך רכב לסופש מתל אביב" → from age 21 (correct); 21–23 stored; Tel Aviv pickup.
2. "מחמישי 19.11 עד ראשון 22.11, מחזיר בתל אביב" → return date and place stored, **pickup date lost** (weekday before the date).
3. "ואפשר שגם חבר שלי ינהג? הוא בן 25" → additional-driver answer correct, but **the friend's 25 replaced the main driver's 21–23 group**.
4. "סבבה תפתח בקשה. יונתן לוי" → intake with name; asked the missing pickup date.
Fixes (next release): weekday names before explicit dates are ignored for parsing (Hebrew and English); another person's age does not change the main driver's group unless that person is stated as the driver ("אחותי בת 25 תנהג"); "נהג ראשי בעלי בן 38" read as the main driver's age.

## Replay on 74f2a42
Dates 19–22/11 and the 21–23 group kept (fixes confirmed). "משהו קטן מספיק. סבבה תפתח בקשה, יונתן לוי" → name stored but "something small" not taken as the vehicle. Fixed (next release): "משהו קטן" / "something small" = compact for rentals; "צריך רכב … מתל אביב" sets the pickup without the model.

## Replay on de9734f
Full summary reached: compact, 19–22/11, Tel Aviv both ways, 21–23, יונתן לוי (all fixes confirmed). Model wording said "מיום רביעי 19.11" (19.11.2026 is a Thursday) → validator `wrong_weekday` (Hebrew and English weekday-next-to-date checks), next release.
