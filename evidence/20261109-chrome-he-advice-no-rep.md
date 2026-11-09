# Chrome live acceptance — Hebrew open advice, no representative wanted (2026-11-09)

- Channel: Claude in Chrome, https://www.smartcar.co.il/he/whatsapp-demo, public 39c3a4d.
- Result: **FAILED at turn 1.**

1. C: שלום, אני סתם מנסה להבין משהו לפני שאני מחליט. אנחנו חושבים על חופשה בצפון בחנוכה, ארבעה מבוגרים. עדיף לשכור רכב אחד גדול או שני קטנים? אני לא צריך נציג, רק דעה
   B (local, escalated=true): "בשמחה, נציג SmartCar יחזור אליכם. אפשר גם להתקשר ל־09-9509757." — state handedOff/human, passengers 4.

Cause: the refusal list lacked "לא צריך/אין צורך … נציג" (and English "don't need a representative"), so "צריך נציג" matched the human-request pattern.

Local repair (unpublished): those refusals join the existing declined-handoff list; a real "אני צריך נציג בבקשה" / "I need a representative please" still escalates. Tests appended to src/lib/__tests__/whatsapp-extension-explicit-request.test.ts (5). Full 1,802/129 pass.
