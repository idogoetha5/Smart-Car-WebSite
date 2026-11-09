# Chrome live acceptance — Hebrew rental for arriving parents (2026-11-09)

- Channel: Claude in Chrome, owner's Chrome, https://www.smartcar.co.il/he/whatsapp-demo
- Public version under test: origin/clean-main 39c3a4d (7d3ca4d and later were local only, not published).
- Type: new human story, not a replay of a known script. Fictional details only.
- Result: **FAILED** (two independent sessions, same first failure). Not counted as acceptance.

## Session A (11:13–11:18 Israel time)

1. C: היי, ההורים שלי נוחתים בשבוע הבא ואני צריכה רכב בשבילם, משהו נוח שיהיה לאבא שלי קל להיכנס ולצאת ממנו. כמה זה עולה בערך לשבוע?
   B: general compact/family advice, price depends on dates, asks dates and branch. — acceptable.
2. C: הם נוחתים בנתב״ג ביום שלישי הבא, עוד לא בטוח אם יישארו שבוע או עשרה ימים. אבא שלי בן 72 והוא ינהג, זה בעיה? ואפשר לאסוף ישר משדה התעופה?
   B: "אפשר בהחלט לאסוף מנתב״ג. גיל 72 הוא מצוין לנהיגה — אפשר לשכור כל עוד יש רישיון בתוקף..." — **wording defect**: unconditional eligibility assurance; approved fact says eligibility depends on cover and vehicle group and is confirmed before booking.
3. C: טוב בוא נגיד עשרה ימים, משלישי הבא עד החמישי שאחריו. אבל אם אמא שלי תרצה לנהוג לפעמים צריך להוסיף אותה? ועדיין לא הבנתי בערך כמה זה ייצא
   B: additional driver must be registered; price depends on group. — answered.
4. C: משפחתית, יהיו גם שתי מזוודות גדולות. לאסוף ולהחזיר בנתב״ג. מה אתה צריך ממני כדי להתקדם?
   B: "רשמתי רכב משפחתי ... חסרים לי רק שמך ומספר הטלפון" (model prose; no intake actually started).
5. C: נועה בדיקה, 050-0000000. במחיר כלול ביטוח או שזה בנפרד?
   B (local): generic price paragraph + "תרצו שנתקדם לבקשה עם הפרטים שכבר מסרתם?" — **FIRST FAILURE**: insurance question ignored, name not kept.
6. C: כן, אבל לא ענית לי על הביטוח
   B: "על איזה שם לרשום את הבקשה?" — name asked again, insurance ignored again.

## Session B (fresh demo session, observational fetch logger only; requests unchanged)

The demo returns the conversation state. Observed after each turn:
- after 2: datePreference "dates undecided", pickupLocation נתב״ג, driverAgeRange 24-plus.
- after 3: **dates still undecided** — "משלישי הבא עד החמישי שאחריו" plus "עשרה ימים" were not stored. Model reply also called the mother "אשתך" (Hebrew/pronoun defect).
- after 4: family car, 2 large bags, return נתב״ג stored; still explore/menu; model asked again for exact dates and "טווח הגילאים" already known.
- after 5: source=local, reply ended "לאילו תאריכים תצטרכו את הרכב?", name not stored, insurance ignored.

## Diagnosis

1. Any message containing a phone/email bypasses Gemini (privacy), and the local branch only handled price wording.
2. A name answered after the model asked for it was not captured because intake had never started (the model's "חסרים לי רק שמך" was prose, not state).
3. "מה אתה צריך ממני כדי להתקדם?" did not count as starting the request.
4. The model receives only an ISO date, so weekday phrases depend on its own weekday arithmetic.
5. Eligibility validator did not cover "גיל 72 הוא מצוין/לגמרי בסדר" style assurances; "טווח הגילאים" was not a known-age re-ask.

## Local repair (unpublished, needs live re-check after publication)

- Explicit "what do you need from me to proceed?" (HE/EN) starts the request draft; consent to send remains separate.
- In an established rental draft, contact details offered right after the assistant asked for the name continue the draft; the leading name clause is captured privately (guards against "כן," / "אני לא בטוחה," / phone-only).
- A local reply to a contact-detail turn prepends the approved policy answer for an attached question.
- Policy side answers during active intake keep the pending field question.
- Gemini receives calendarIsrael (35 days with HE/EN weekdays) and is told to extract weekday dates only when unambiguous and consistent with a stated duration, otherwise ask with candidate dates.
- Reply validation rejects unconditional age eligibility assurances; "טווח הגילאים" counts as a known-age re-ask; English age questions map to the approved age/licence answer.
- New tests: src/lib/__tests__/whatsapp-parents-airport-rental.test.ts (12). Full suite 1,786/128, tsc, lint 0 errors/1 existing warning.

Still open from this story: the model's "אשתך" for "אמא שלי"; the model's "רשמתי … חסרים לי רק שמך" text while dates were missing; no rough price range offered after two price questions (no approved price range exists in approvedFacts — needs an owner decision, not invention).
