# Human rental pivot in native Chrome — 8 November 2026

Version: production 2fe8020, READY dpl_4rVbMYJP6QogKGWQaA6xNWor4yqh. www inspection resolved to this deployment. Earlier four garage-regression inputs were followed by spontaneous new directions after the owner specifically requested varied human conversations. This story is **FAIL**; no request was confirmed or created. Exact later messages and replies follow. Initial four messages are recorded in 20261108-chrome-rental-provider-outage.md; on this version they received varied answers instead of repeated fallback. One answer used “אישתי” for the customer's wife and omitted the price question; these remain voice/coverage observations.

## 5 — Mobility needs, wife arriving later, unanswered price

Customer: רגע, לא בטוח קטן. מחר אני צריך לקחת גם את אמא שלי עם הליכון, אז אולי משהו קצת יותר גבוה יהיה לה נוח. ואם אשתי תצטרף רק ביום השני היא חייבת לבוא איתי מחר? ועל הכסף עוד לא ענית לי

Bot: רכב גבוה כמו SUV יכול להיות נוח יותר לעלייה ולסידור הציוד של אמא. לגבי אשתך, נהג נוסף חייב להציג רישיון ולהירשם בחוזה לפני הנהיגה, כך שהיא תוכל להצטרף ולהירשם כשתגיע. מבחינת מחיר, השכרת SUV מתחילה בדרך כלל מסביב לפיקדון ועלות יומיות שנקבעות בהצעה (הפיקדון האינדיקטיבי ל־SUV הוא 2,000–2,500 ₪). האם תרצה שנבדוק קבוצת SUV מהרצליה?

Observation: deposit presented confusingly in response to rental-price question; accessibility benefit insufficiently qualified by actual model.

## 6 — Customer reacts to confusing price explanation

Customer: רגע אני משלם אלפיים שקל על יומיים?? זה ממש לא מה שחיפשתי. אני שואל כמה עולה ההשכרה עצמה, לא כמה תופסים באשראי. ואולי בכלל אקח רק ליום אחד אם זה כזה יקר

Bot: הפיקדון הוא מסגרת אשראי זמנית שמשתחררת לאחר ההחזרה, ולא עלות ההשכרה עצמה שנקבעת בהצעה. השכרה ליום אחד בהרצליה אפשרית, והמחיר המדויק תלוי בדגם ובעונה. האם תרצה שנבדוק עלות להשכרת SUV ליום אחד?

## 7 — Keep two days, no selected SUV

Customer: לא אמרתי שאני רוצה ג׳יפ 🙂 קודם תסביר מה ההבדל במחיר, ואם אין לך מחיר כרגע תגיד. בינתיים תשאיר יומיים כמו שסיכמנו, ואני עוד לא בחרתי סוג רכב. מה צריך בשביל לקבל הצעה מסודרת בלי להתחייב?

Bot: אין לי מחיר מדויק או מחירון קבוע לשלוף בשיחה, כי העלות משתנה לפי הדגם, העונה ותקופת ההשכרה המדויקת ונקבעת בהצעה מסודרת. כדי לקבל הצעה כזו ליומיים מהרצליה ולהחזיר שם מבלי להתחייב, נצטרך את תאריכי האיסוף וההחזרה המדויקים, מיקומי האיסוף וההחזרה, קבוצת גיל הנהג, וצרכי הרכב שלך. האם תרצה שנתחיל לבדוק את זה?

Observation: a generic required-details list asks for already supplied facts.

## 8 — Proceed with saved facts and a volunteered name

Customer: אבל כבר כתבתי מחר ליומיים והרצליה בשני הכיוונים ושאני בן 31. למה מתחילים מהתחלה? תתקדם עם מה שיש, קוראים לי איתי בדיקה ואין לי מייל לתת

Bot: אתה צודק לגמרי, הפרטים שלך כבר שמורים אצלנו ליומיים מהרצליה להחזרה שם. מכיוון שסוג הרכב עדיין פתוח — קומפקטי, משפחתית או SUV שנוח יותר עם הליכון — איזה כיוון נראה לך הכי מתאים כרגע?

## 9 — Select family and change return day

Customer: נלך על משפחתית וזהו, אם לא יתאים להליכון נדבר. רגע עכשיו המוסך אומר שהרכב שלי יהיה מוכן רק בחמישי אז עדיף שאחזיר בחמישי. האיסוף עדיין מחר

Bot: רשמתי מעבר למשפחתית והחזרה ביום חמישי מהרצליה. האם תרצה שנתקדם עם בקשת ההצעה המסודרת לפי הפרטים הללו?

## 10 — Proceed with an insurance question

Customer: כן, תכין לי את ההצעה. רק לפני כן הביטוח כולל הכול? אני לא רוצה הפתעות אם מישהו שורט בחניה

Bot: שאלה חשובה. בכל השכרה כלול כיסוי בסיסי: ביטוח חובה ונזקי תאונה, אש וגניבה בכפוף להשתתפות עצמית. גובה ההשתתפות והאפשרות להפחית או לבטל אותה נקבעים בהצעה ובחוזה; נהג שלא נרשם אינו מכוסה.

על איזה שם לרשום את הבקשה?

Failure: repeats name supplied in turn8.

## 11 — Natural answer with a side comment

Customer: איתי בדיקה, כתבתי את זה קודם. בלי מייל בבקשה. אפשר כבר לראות את כל הפרטים לפני שאני מאשר?

Bot: הבשורה על הפרטים שלך כבר שמורה אצלנו. לפיצוח ההצעה המסודרת לאיסוף מחר מהרצליה והחזרה בחמישי עם רכב משפחתי, ההצעה כוללת ביטוח בסיסי בכפוף להשתתפות עצמית. תוכל לוודא את שמך המלא שיופיע בבקשה?

Failure: another name request and malformed Hebrew wording.

## 12 — Explicit frustration and full name again

Customer: אני מרגיש שאנחנו מסתובבים במעגל. קוראים לי איתי בדיקה, זה השם המלא לבדיקה. בבקשה אל תשאל אותי שוב את אותו הדבר, פשוט תראה לי מה רשמת

Bot summary: family car; 09/11/2026–12/11/2026; pickup הרצליה; **return חמישי**; main age24+; name איתי בדיקה. Includes existing terms/privacy statement and asks final confirmation. No confirmation sent.

Failure: temporal phrase became return location.

## 13 — Correct the error in ordinary language

Customer: חמישי זה היום, לא המקום 😅 אני מחזיר בהרצליה כמו שאמרתי. ותשאיר משפחתית

Bot: repeats the same summary, still **return חמישי**. No confirmation sent. Stopped because the wrong summary could not be corrected naturally.

## Repair scope and limits

Local repairs retain volunteered labelled names during established rental advice without treating disclosure as final consent; split a prompted name from comma-delimited side comments; reject temporal values in deterministic, prompted and legacy model locations; accept present-tense Hebrew return corrections in local parsing and bounded branch proposals; retain explicitly undecided vehicle choice. Prompt guidance addresses the observed deposit/price confusion, accessibility assumptions, family pronouns and redundant lists, but these wording changes require live proof. Unit fixtures are controlled, not real-model conversations.

Provider-status follow-up: error-log query on 2fe8020 found no error logs after this replay. Varied model-like responses and no400 support recovery, but a new live Network response with source/model should be inspected before treating provider integration as fully accepted. The previous failure category remains a confirmed HTTP400; schema complexity was the repair hypothesis, not a captured raw provider error.
