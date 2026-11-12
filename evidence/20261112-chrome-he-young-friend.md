# Live Chrome — Hebrew: 22-year-old driver and a friend (2026-11-12, public 22edfad)
1. "אהלן אני בן 22, אפשר לשכור אצלכם? צריך רכב לסופש מתל אביב" → from age 21 (correct); 21–23 stored; Tel Aviv pickup.
2. "מחמישי 19.11 עד ראשון 22.11, מחזיר בתל אביב" → return date and place stored, **pickup date lost** (weekday before the date).
3. "ואפשר שגם חבר שלי ינהג? הוא בן 25" → additional-driver answer correct, but **the friend's 25 replaced the main driver's 21–23 group**.
4. "סבבה תפתח בקשה. יונתן לוי" → intake with name; asked the missing pickup date.
Fixes (next release): weekday names before explicit dates are ignored for parsing (Hebrew and English); another person's age does not change the main driver's group unless that person is stated as the driver ("אחותי בת 25 תנהג"); "נהג ראשי בעלי בן 38" read as the main driver's age.
