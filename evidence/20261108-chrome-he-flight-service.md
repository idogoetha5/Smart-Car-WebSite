# New Hebrew flight-change / advance-payment service story

8 November 2026, native user Chrome public demo, fresh business conversation on faa9f56, READY dpl_HSdDpe7dZLGXxCwYFT6BHuT8DMe8. No real booking, message or payment action. **FAIL at turn2**; not a completed acceptance story.

1. Customer: היי, עשיתי הזמנה לשבוע הבא אבל הטיסה שלנו השתנתה. אני לא יודעת עדיין אם נגיע בכלל או רק ליומיים. שילמתי מקדמה אז לפני שאני מחליטה רציתי להבין מה האפשרויות

Bot: היי! אם זמני הטיסה שלכם השתנו ואתם עדיין שוקלים את האפשרויות, כדאי לדעת ששינוי תאריכים ללא חיוב אפשרי עד 48 שעות לפני האיסוף בכפוף לזמינות. ביטוחה או שינוי ייבדקו לפי זמני ההודעה. האם תרצו שנבדוק את האפשרויות ברגע שתחליטו על משך השהייה החדש?

Observation: malformed word “ביטוחה”; wording also needs to distinguish a change fee from any recalculated rental price. No language-quality pass inferred.

2. Customer: ואם נגיע רק ליומיים במקום ארבעה, מחזירים אוטומטית את ההפרש? זה בעוד שבוע, לא מחר. אל תבטל לי בינתיים אני עוד מחכה לתשובה מחברת התעופה

Bot: הבנתי את הכיוון. כדי לבדוק זמינות ולהכין בקשה, באילו תאריכים מדויקים תרצו לאסוף ולהחזיר את הרכב? אפשר לכתוב למשל 2/11–26/11.

Failure: existing paid-booking/refund question replaced by a new-rental date prompt. The approximate-week matcher ran before Gemini.

3. Customer: לא, יש לי כבר הזמנה, שאלתי על המקדמה ששילמתי ומה קורה אם מקצרים. אני לא מנסה לעשות הזמנה חדשה ולא יודעת עוד אם לקצר בכלל

Bot: אין בעיה. כשתדעו את התאריכים המדויקים, כתבו אותם כאן ונוכל להמשיך מהפרטים שכבר מסרתם.

Failure: another pre-model uncertainty shortcut swallowed the correction because a stale undecided-date marker existed.

## Local repair awaiting live proof

Approximate/unknown-date branches now run after model understanding as a limited fallback for short date answers; service/policy interpretations and private turns bypass that fallback. Compound substantive messages reach the model. Approximate-date state retains the extracted timing phrase and accumulated rough range, without storing an entire raw message. Generic “already told you” complaints no longer trigger an unrelated pickup-hour apology unless the previous bot actually asked about hours. “Hi, can I ask…” is a greeting shortcut only when the entire message is a greeting/question opener; the substantive question is otherwise interpreted normally. Existing safety, identity, private intake and final action-consent boundaries remain.

Controlled regressions cover this full three-message input sequence, stale date markers in both languages, compound greetings and natural correction complaints. They do not count as live model acceptance.

## Prior English repair spot-check on faa9f56

After the legacy mistaken change alert, customer: “Wait, I didn't ask you to extend it. I'm still figuring out who can get the car back. Can we just talk through the options without sending another request?”

Bot: “Of course, we can just discuss the options without changing anything or sending a new request. The original return time on your paperwork remains binding until any extension is officially confirmed. Let me know what you decide about getting the car back.”

Customer then asked whether the earlier reference was retained and whether the original deadline still applied. Bot said the reference was saved and did not need finding again, and confirmed the original deadline remained binding until an extension was confirmed. No new escalation marker appeared. This is a scoped legacy-recovery pass, not a full fresh English story. Actual reference storage should also be checked in a fresh current-version conversation.

## CI distinction

faa9f56 GitHub run42467992409 failed at Build with the known intermittent Next/Turbopack Google-font query/import error. Production deployment and local build were READY/successful separately. No font, style, dependency, domain or DNS change was made to force the check green. The next commit's CI must be inspected; do not describe this older CI as successful.
