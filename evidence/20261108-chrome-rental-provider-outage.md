# Fresh Chrome rental replay — 8 November 2026

Result: **FAIL**, not customer acceptance. Native user Chrome, public `/he/whatsapp-demo`, fictional details. No simulator HTTP requests, quota resets, real bookings or customer messages were used. Production alias inspection resolved www to READY `dpl_vTHQgsyUYizyFdzBgTUvqcP259Sn`, the successful retry of a37925e. Earlier Vercel failure mail refers to dpl_2zYC47HwrMw5r3h1xpkmppSxZAMe, not this retry.

1. Customer: אהלן יש מצב לרכב כזה לכמה ימים? שלי נכנס למוסך ואני עוד לא יודע מתי יוציאו אותו

   Bot: נשמח לעזור לכם לבחור רכב מתאים ב־SmartCar. כך אפשר להתאים את המרחב והנוחות למשך הנסיעה ולציוד שלכם. אפשר לבחור כיוון לרכב כבר עכשיו; זמינות ומחיר נבדוק כשתדעו את התאריכים.

2. Customer: אבל זה הקטע שאין לי תאריך להחזרה.. אני צריך להגיע לעבודה מחר. אולי אקח ליומיים ואז נראה? זה אפשרי או שאני מסתבך?

   Bot: Exact repetition of turn 1's complete answer above. Did not address the short rental / potential extension question.

3. Customer: אני בהרצליה. לא צריך איזה משהו מפואר רק שלא יהיה יקר. כמה בערך? ואשתי יכולה לנהוג גם או שצריך לעשות משהו בשביל זה?

   Bot: Exact repetition of turn 1's complete answer above. Did not address price or additional-driver question.

4. Customer: מחר כמו שאמרתי 🙂 בוא נלך על קטן ליומיים, מהרצליה ולהחזיר שם. רגע אשתי בת 23 ואני 31, זה משנה את מה שאמרת?

   Bot: הבנתי את תאריכי האיסוף וההחזרה. מאיפה תרצו לאסוף את הרכב?

5. Customer: כן יאללה. קוראים לי איתי בדיקה. רק שלא תסגור לי משהו יקר בלי להגיד לי, אני רוצה קודם לדעת מה ההצעה

   Bot: רכב קומפקטי של SmartCar יכול להתאים לנסיעה שלכם. כך אפשר להתאים את המרחב והנוחות למשך הנסיעה ולציוד שלכם. מאיפה תרצו לאסוף את הרכב?

## Runtime and incident evidence

Vercel error log on this READY deployment at 10:50:18.83 Israel time: `[whatsapp-gemini] provider HTTP 400; using local knowledge` for POST /api/whatsapp/simulator. SmartCar incident email at 08:50:20 UTC reports ai_unavailable, event window 08:45 UTC. This proves provider rejection/fallback, not quota exhaustion or invalid production credentials. Repeated replies agree with the fallback observation, but every individual turn's provider source was not separately inspected.

Production env download does not return readable sensitive Gemini values. A local diagnostic without an available key returned 401; it is NOT evidence about the deployed key. No key was changed or exposed.

Google's current structured-output guide explains that bounded arrays duplicate item grammars and can cause 400 INVALID_ARGUMENT for excessive schema states. The new patch schema added maxItems16 around a nested optional/enumerated item. Removing only this provider bound is a bounded repair hypothesis; runtime still rejects more than16 proposals. Fixed-category rejection logging permits diagnosis without recording provider messages/customer input. Full live recovery and rental/service acceptance remain required.

Primary reference: https://ai.google.dev/gemini-api/docs/structured-output#simplifying-complex-schemas
