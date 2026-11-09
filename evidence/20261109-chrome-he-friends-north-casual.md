# Chrome live — casual Hebrew advice, four friends to the north (2026-11-09, public 72cd92a)

Written as a customer types on WhatsApp (owner feedback: talk like a person, short and casual).

1. C: היי מה נשמע → B: friendly social reply. Pass.
2. C: בסדר תודה. אנחנו 4 חברים רוצים לעלות לצפון בחנוכה לכמה ימים, עדיף רכב אחד גדול או 2 קטנים? → B (gemini): compares one large vs two compact. Pass; awkward Hebrew "כיף של טיול לצפון!".
3. C: כנראה אחד. כל אחד עם מזוודה בינונית זה נכנס ברכב משפחתי רגיל? → B: conditional fit answer; **no false safety alarm** (the b9908ed regression is fixed). State defect: luggage stored as 1, not 4.
4. C: עוד לא יודעים תאריכים בדיוק. כמה בערך זה יוצא ל4 ימים? → B: price depends on car/season; no range (no approved price range exists — owner decision).
5. C: בסדר נדבר כשנדע תודה → B: "בבשמחה, מחכים לכם פה..." — typo.

Outcome: advisory conversation reached a natural close without unwanted handoff — PASS on flow, with wording defects (awkward phrase, typo) and the luggage count defect.

Local repair: "כל אחד עם מזוודה" / "each of us with a (medium) suitcase" sets bags = known travellers; "we are N" / "N friends" count as travellers. Tests added.
