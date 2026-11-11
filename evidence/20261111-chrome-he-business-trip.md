# Chrome live — casual Hebrew business trip (2026-11-11, public 9d8bb3a)

1. "צריך רכב למחר בבוקר מתל אביב, יש לי פגישות בחיפה ובבאר שבע" → pickup 12/11 תל אביב stored. Pass.
2. "עד רביעי. משהו נוח לנסיעות ארוכות, סדאן נגיד" → return 18/11 stored; **"סדאן" not stored** while the model said "בחרנו בקבוצה המשפחתית"; irrelevant child-seat offer.
3. "בעצם עד חמישי, הוסיפו לי פגישה. ואפשר להחזיר בנתב״ג כי יש לי טיסה?" → return 19/11 and נתב״ג stored, but the reply ended "כשתדעו את התאריכים" although dates were known.
4. "סבבה תפתח בקשה. איתי בדיקה בן 45. צריך קבלה על שם החברה" → **FAILED**: intake not started; model claimed "פתחנו את הבקשה"; name lost; invoice question ignored; child-seat offer again.

Repairs: sedan → family group "(סדאן)"; validator rejects vehicle-choice claims when no vehicle is saved and "פתחנו/פתחתי את הבקשה"; airport-route reply uses known dates and offers to start; "תפתח/תכין בקשה / open a request" starts intake; child-seat offers rejected when no child/seat was mentioned; company receipt/invoice question gets a non-committal note; a name followed by "בן 45" is captured (pronoun/driver words excluded). Tests added.
