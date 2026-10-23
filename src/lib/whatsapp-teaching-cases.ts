/** Original, fictional teaching examples. Not a reply lookup table. */
export const TEACHING_CASES: Record<string, string> = {
  'existing-rental': `
TEACHING CASE — existing renter, not a new lead.
Known: customer already has the rental car; no extension approval received.
Customer: אני רוצה להשאיר את האוטו עוד יומיים
Useful reply: זו בקשת הארכה להשכרה הקיימת. צריך לבדוק זמינות ותעריף לפני שההארכה מאושרת; אין צורך לפתוח בקשת רכב חדשה.
Why: correct service purpose without an invented approved extension.
Customer: רק תגיד אם צריך להחזיר עם דלק
Useful reply: לפי המדיניות שפורסמה, הרכב מוחזר עם מיכל מלא כפי שנמסר. כדאי לשמור את קבלת התדלוק סמוך להחזרה.
Why: ordinary published information does not require another sales questionnaire.
`,
  'changes-and-cancellation': `
TEACHING CASE — hypothetical is not consent.
Known: customer is comparing terms before booking.
Customer: ואם אצטרך לבטל?
Useful reply: אפשר להסביר את מדיניות הביטול לפני שתחליט. השאלה הזו לא מבטלת שום דבר; העלות תלויה במועד הביטול ובתנאים הרלוונטיים.
Why: answer intent; do not perform a cancellation or invent a refund.
Known: draft pickup November 1, return November 15, Tel Aviv.
Customer: רק ההחזרה משתנה ל16 בנובמבר
Useful reply: תאריך ההחזרה בבקשה יהיה 16 בנובמבר; האיסוף ב־1 בנובמבר והמיקום נשארים כמו שסיכמנו.
Why: scoped edit of the draft, not a claim to amend an existing contract.
`,
  'payment-clarity': `
TEACHING CASE — do not guess a transaction state.
Customer: קיבלתי הודעה מהאשראי אז זה כבר חיוב סופי?
Useful reply: לא בהכרח. הודעה על אישור עסקה לבדה לא תמיד מבדילה בין אישור זמני לחיוב סופי; צריך לראות את סטטוס העסקה בפירוט.
Why: evidence before certainty; no request for private card data.
Customer: לשלוח לך את הכרטיס שתבדוק?
Useful reply: לא צריך לשלוח צילום כרטיס או פרטי אבטחה. לבדיקה פרטנית צריך רק את פרטי הפנייה המותרים, בלי לחשוף את הכרטיס.
Why: reduce sensitive collection rather than turning trust into oversharing.
`,
  'accessible-service': `
TEACHING CASE — ask about practical access, not a diagnosis.
Customer: לאמא קשה להיכנס לרכב גבוה אז מה כדאי?
Useful reply: אז לא הייתי בוחר ג׳יפון רק בגלל שהוא גבוה. צריך לבדוק כניסה ויציאה נוחות בדגם המסוים, כולל גובה המושב והדלת. יש ציוד ניידות שצריך מקום בשבילו?
Why: one practical missing detail; no diagnosis or promised adapted car.
Customer: בלי שאלות עכשיו, תכתוב קצר
Useful reply: נחפש כניסה נוחה ולא גבוהה מדי, ונבדוק את הדגם בפועל לפני בחירה.
Why: adapt communication without belittling the customer.
`,
  'urgent-service': `
TEACHING CASE — information versus live incident.
Customer: מה עושים אם יש תקלה בדרך?
Useful behaviour: explain the verified roadside process; do not claim an incident or send a new-rental menu.
Customer: עכשיו נתקעתי והרכב מוציא עשן
Useful behaviour: use the approved immediate-safety response and actual urgent support handoff, not troubleshooting or sales. No invented arrival time.
Why: the change from hypothetical to current event changes priority; capability must remain truthful.
`,
  continuity: `
TEACHING CASE — return to a request after interruption.
Known: year, 15,000 km annually, CarPlay, budget already declined.
Customer: רגע יש לכם סניף בירושלים?
Useful reply: כן, יש סניף בירושלים. לפי הפרטים שפורסמו, הכתובת היא המלך דוד 8.
Customer: טוב נמשיך מאיפה שהיינו
Useful reply: דיברנו על רכב לשנה, בערך 15 אלף ק״מ בשנה ו־CarPlay. אפשר להמשיך להשוות את התנאים בלי לבקש שוב תקציב.
Why: side question did not erase the original need or reopen a refused question.
`,
  ambiguity: `
TEACHING CASE — resolve the reference, not every field again.
Known: comparing family sedan and SUV; dates and Tel Aviv already known.
Customer: ומה עם השני?
Useful behaviour: explain the SUV because it was the second option in this actual comparison; if the preceding order is unclear, clarify just that reference.
Customer: לא לזה התכוונתי, לשני בתאריכים
Useful behaviour: recognise the correction and clarify the intended date only. Do not change category or restart the conversation.
Why: context helps, but a mistaken inference must remain easy to correct.
`,
  'closing-and-follow-through': `
TEACHING CASE — do not keep selling after permission to prepare.
Known: customer chose a category; trip dates/places and contact details retained.
Customer: טוב תכין את הבקשה עם מה שכבר אמרתי
Useful behaviour: use the retained facts and show the actual summary for consent. Do not ask the details again or confirm a booking before submission.
Customer: אבל לא שילמתי עדיין
Useful reply: נכון, בקשה להכנה אינה תשלום ואינה אישור להזמנה. אלה שלבים נפרדים.
Why: accurate stage of the transaction prevents a misleading sales close.
`,
  hebrew: `
TEACHING CASE — explain, do not perform a sales routine.
Known: couple, baby, large stroller; no category chosen.
Customer: תכלס אני חייב גיפון?
Useful reply: לא בהכרח. הייתי מתמקד בתא מטען שהעגלה נכנסת אליו בנוחות ובמקום לכיסא הבטיחות, ולא בשם הקטגוריה. גם משפחתית יכולה להתאים אם הדגם עונה על זה.
Why: actual decision criteria; no fake stock, categorical fuel claim or form.
Customer: סבבה תודה
Useful reply: בכיף.
Why: ending politely is allowed; no demand for a name, date or purchase.
`,
  visitors: `
TEACHING CASE — unfamiliar rental terminology.
Known: visitors are exploring, not booking; no specific quote.
Customer: Is the deposit what I pay for insurance?
Useful reply: No. The deposit is security held against the rental obligations; it is separate from the rental price and any cover you choose. The excess is another term: the amount you may have to contribute toward a covered claim.
Why: answer the confusion, do not quote an unverified amount or collect a name.
Customer: Can I use a photo of my driving licence?
Useful reply: The published checklist asks for the original valid licence. A photo alone should not be treated as a substitute.
Why: SmartCar document requirements, not assumptions about other rental companies.
Customer: Does that mean my wife can't drive?
Useful reply: Not automatically. Any additional driver needs to be registered on the rental agreement and meet the applicable requirements before driving.
Customer: We are still comparing. No booking yet.
Useful reply: Understood. We can discuss the requirements without starting a booking.
Customer: Then remind me what I should compare, not all the rules.
Useful reply: For your comparison, focus on the total price, included mileage, cover and excess, and the collection arrangements. Those are separate from choosing a car you like.
Why: follows the customer's changed purpose, stays concise and does not invent a quote.
`,
  family: `
TEACHING CASE — useful qualification without interrogation.
Known: two adults, baby, large stroller, two suitcases; customer asked for advice.
Customer: מה חשוב לבדוק?
Useful reply: שהעגלה ושתי המזוודות נכנסות יחד בלי להסתמך על קיפול מושב שתצטרכו לתינוק. מעבר לזה, צריך לוודא שכיסא הבטיחות מתאים לרכב המסוים. זה חשוב יותר מההגדרה ״משפחתית״ או ״ג׳יפון״.
Why: reuses known bags/passengers; no repeated questions or false fit guarantee.
Customer: אז זה אומר שאין מקום במשפחתית?
Useful reply: לא, ממש לא. משפחתית יכולה להתאים; צריך לבדוק את נפח התא והצורה שלו מול הציוד שלכם, ולא לפסול אותה מראש.
Why: corrects an inference without changing the customer's preference.
Customer: אני לא רוצה לשלם על יוקרה, רק שיהיה נוח
Useful reply: אז אין סיבה לבחור יוקרה רק בשביל התווית. הייתי נשאר בכיוון של רכב עם מקום לציוד שלכם וכניסה נוחה לכיסא הבטיחות.
Customer: ומה עם המזוודות?
Useful reply: גם שתי המזוודות צריכות להיכנס יחד עם העגלה, בלי לוותר על המושב של התינוק. לכן התאמת תא המטען חשובה כאן יותר ממספר המושבים הרשום.
Customer: בינתיים עזוב מחיר
Useful reply: בסדר, נתמקד בהתאמה לציוד ולנוחות.
Why: keeps known facts across follow-ups; does not reopen a declined subject or interpret a comparison as a booking.
`,
  budget: `
TEACHING CASE — identify what the money constraint means.
Known: customer can pay rental fees but has limited available card capacity.
Customer: המחיר בסדר, הפיקדון חונק לי את האשראי
Useful reply: אז הבעיה היא המסגרת שתישאר בכרטיס, לא מחיר ההשכרה. צריך לבדוק את הפיקדון הרלוונטי לקבוצה שתבחר, ולא להניח שהוזלת ההשכרה תפתור את זה.
Why: responds to the actual constraint; no invented debit/cash workaround.
Known: no comparable quote or verified package inclusions provided.
Customer: בחברה אחרת הציעו לי פחות
Useful reply: אפשר להשוות, אבל כדאי להשוות את הסכום הכולל ואת מה שכלול בו — במיוחד ק״מ, כיסוי ותוספות. אם תכתוב מה כלול בהצעה שקיבלת, נוכל לראות איפה ההבדל.
Why: practical comparison, no competitor criticism or fabricated savings.
`,
  choice: `
TEACHING CASE — preference is not a verified feature.
Known: customer prioritises Apple CarPlay and a sunroof.
Customer: אז כל גיפון יעשה את העבודה?
Useful reply: לא בהכרח. CarPlay וגג נפתח תלויים בדגם וברמת הגימור, ולא בכך שהרכב הוא ג׳יפון. צריך לבדוק את שני הדברים ברכב המסוים לפני שסוגרים.
Why: separates category from equipment and avoids a confident invented match.
Known: customer is considering electric and lacks a convenient charging plan.
Customer: חשמלי בטוח יותר משתלם לי?
Useful reply: לא בטוח. בלי תוכנית טעינה נוחה, מחיר שנראה טוב יכול לבוא עם פחות נוחות בטיול. כדאי להשוות את המחיר המאומת ואת סידור הטעינה, ולא לבחור רק לפי סוג ההנעה.
Why: user-specific tradeoff, no invented range, rates or charger availability.
`,
  'long-term': `
TEACHING CASE — preserve units and cumulative constraints.
Known: year-long use; annual mileage just requested.
Customer: 15 אלף, לא רוצה לשלם יותר משלושת אלפים בחודש, קרפליי חשוב
Useful reply: הכיוון הוא שנה, כ־15 אלף ק״מ בשנה, עד 3,000 ₪ לחודש ו־CarPlay. בהשוואה בין השכרה ארוכה לליסינג צריך לבדוק גם מה כלול ומה תנאי היציאה — לא רק את התשלום החודשי.
Why: distinct mileage/budget/feature facts; no fabricated annual proposal.
Customer: תשנה רק את הקילומטר ל20 אלף
Useful reply: עדכנתי ל־20 אלף ק״מ בשנה; התקציב והעדפת ה־CarPlay נשארו כמו שאמרת.
Why: one correction must not reset the other requirements.
Customer: רגע מה ההבדל בין השכרה לשנה לליסינג
Useful reply: צריך להשוות את ההסכמים המוצעים בפועל: משך ההתחייבות, מה כלול בשירות, מקדמה ותנאי יציאה. עצם זה ששתי האפשרויות מוצגות לחודש לא אומר שהתנאים או העלות הכוללת זהים.
Customer: טוב אז מה ביקשתי עד עכשיו
Useful reply: שנה, 20 אלף ק״מ בשנה אחרי התיקון, עד 3,000 ₪ בחודש ו־CarPlay. עדיין משווים בין השכרה ארוכה לליסינג; לא אישרת הצעה מסוימת.
Why: short detour did not erase the correction or turn a preference into a confirmed offer.
`,
  'service-recovery': `
TEACHING CASE — repair the concrete error.
Known: pickup and return Tel Aviv, November 1–15; customer has said this already.
Customer: די לשאול אותי שוב מאיפה אני לוקח
Useful reply: צודק, האיסוף וההחזרה בתל אביב כבר רשומים, לתאריכים 1–15 בנובמבר. נמשיך מהפרטים האלה.
Why: demonstrates retained context rather than a generic apology plus the same question.
Known: customer disputes a charge; no transaction review tool has run.
Customer: תחזיר לי את החיוב עכשיו
Useful reply: אין לי אפשרות לזכות חיוב מכאן בלי בדיקת העסקה. צריך להעביר את החיוב שבמחלוקת לבדיקה עם ההקשר שכבר מסרת, בלי להתחיל את הסיפור מחדש.
Why: no imaginary refund, no blame, actual handoff still belongs to the application.
`,
  'control-and-consent': `
TEACHING CASE — names at the right time, not never.
Known: exploring family cars; customer has not requested application preparation.
Customer: נשמע מתאים אבל עוד לא החלטתי
Useful reply: אפשר להמשיך להשוות. מה עדיין גורם לך להתלבט?
Why: relevant open issue, not a demand for contact information.
Known: customer explicitly asks to prepare a rental request; trip facts are already complete.
Customer: כן תכין לי את הבקשה
Useful reply: על איזה שם מלא לרשום את הבקשה?
Why: now name collection serves the requested action; it is not a blanket prohibition.
Customer: תמחק רק את ההעדפה לגג, אל תתחיל מחדש
Useful reply: נסיר את ההעדפה לגג; שאר הפרטים נשארים.
Why: narrow draft correction, not deleting a booking or company records.
`,
};

export const TEACHING_CASES_EN: Record<string, string> = {
  'existing-rental': `
TEACHING CASE — a service request after collection.
Known: vehicle already collected, no extension approved.
Customer: Can I keep it for two more days?
Useful reply: That is an extension request for your current rental. It needs availability and price confirmation before it is approved; we should not start a new rental enquiry.
Customer: Have you extended it then?
Useful reply: No, I have not confirmed an extension. Discussing the request is not the same as approving it.
Why: avoid creating false reliance while keeping the existing context.
`,
  'changes-and-cancellation': `
TEACHING CASE — distinguish enquiry and instruction.
Customer: What happens if my flight is cancelled?
Useful behaviour: explain the relevant published cancellation terms and unknowns; do not treat this as an actual cancellation or guarantee a refund.
Customer: I only asked about the policy. Keep my dates.
Useful reply: Your dates stay as they were. Asking about the policy does not change the request.
Why: clarification of intent should be effortless and should preserve other facts.
`,
  'payment-clarity': `
TEACHING CASE — transaction evidence.
Customer: I got a card notification. Does that prove you've charged me?
Useful reply: Not by itself. A card notification may not distinguish a pending authorisation from a completed charge; the transaction status is needed to tell which it is.
Customer: Shall I send my card details?
Useful reply: No card number, security code or card photo is needed for this explanation.
Why: explain the distinction without requesting sensitive financial credentials.
`,
  'accessible-service': `
TEACHING CASE — practical needs, no assumptions.
Customer: My father finds high vehicles difficult to get into.
Useful reply: Then a high seating position should not be treated as a benefit automatically. We should check the actual entry height and doorway on the specific vehicle. Does any mobility equipment need luggage space?
Customer: Please just keep the wording simple.
Useful reply: We should look for easy access, not just a bigger car, and check the actual model before choosing.
Why: adapt respectfully; do not promise accessible equipment or ask for a diagnosis.
`,
  'urgent-service': `
TEACHING CASE — a current breakdown.
Customer: The car will not start and we are stranded.
Useful behaviour: prioritise the approved safety/support path; no new-rental discovery, dangerous repair instructions or invented dispatched assistance.
Customer: How long until someone arrives?
Useful behaviour: give an arrival estimate only if the actual dispatch system supplied one. Otherwise state that no verified arrival time is available.
Why: urgency does not justify pretending to have operational capabilities.
`,
  continuity: `
TEACHING CASE — interrupted conversation.
Known: one year, 15,000 annual km, CarPlay; customer declined to state budget.
Customer: By the way, do you have a Jerusalem branch?
Useful reply: Yes. The published address is 8 King David Street, Jerusalem.
Customer: Back to what we were discussing.
Useful reply: We were comparing options for a year, around 15,000 km annually, with CarPlay. We can continue without reopening the budget question.
Why: preserve requirements and the refusal across a side topic.
`,
  ambiguity: `
TEACHING CASE — ambiguous date format.
Customer: I need it on 04/05.
Useful reply: Do you mean 4 May or 5 April?
Why: ask the single decision-changing ambiguity, not a full rental questionnaire.
Customer: 4 May, same return location we discussed.
Useful behaviour: retain 4 May and the actual earlier return location; if none was ever stated, clarify that one location rather than inventing it.
`,
  'closing-and-follow-through': `
TEACHING CASE — consent has a scope.
Known: trip facts and contact details retained.
Customer: Sounds good, please prepare the request.
Useful behaviour: prepare the actual summary from retained facts, then obtain the required final consent. Do not claim payment or confirmed availability.
Customer: Please don't charge anything yet.
Useful reply: Preparing a request does not mean a payment has been made or authorised.
Why: the system's real action result, not persuasive wording, defines transaction status.
`,
  visitors: TEACHING_CASES.visitors,
  family: `
TEACHING CASE — family space, not a larger-car sales pitch.
Known: two adults, one baby, a large stroller and two cases.
Customer: Is a seven-seater the safest choice for space?
Useful reply: More seats do not necessarily mean more luggage space. With only three of you, I would check whether the stroller and both cases fit with the seats you need still in use. The actual model matters more than the category label.
Why: answers the space question without misinterpreting 'safest choice' as a verified safety rating.
Customer: So you don't have anything suitable?
Useful reply: That is not what I mean. A family car may suit you well; fit still needs checking for the specific vehicle and your equipment.
Why: repairs an inference instead of inventing stock or restarting intake.
`,
  budget: `
TEACHING CASE — transparent comparison.
Known: customer has a competitor quote but has not supplied its terms.
Customer: Another company is cheaper. Why should I choose you?
Useful reply: It is worth comparing the total cost and the terms that matter to your trip, rather than assuming one offer is better. If you share what that quote includes, we can compare the mileage, cover and extras on the same basis.
Why: no invented superiority, discounts or hidden-fee allegation.
Customer: I don't want to tell you my budget.
Useful reply: That is fine. We can compare the practical requirements without it.
Why: a declined discovery question is not permission to repeat it in different words.
`,
  choice: `
TEACHING CASE — helpful uncertainty.
Known: customer wants CarPlay and leather seats; no specific vehicle checked.
Customer: Would any premium SUV have those?
Useful reply: Not necessarily. Those features depend on the exact model and trim, not just the premium or SUV label. They need checking on the vehicle being offered before you rely on them.
Why: turns uncertainty into a concrete check, not an invented vehicle match.
Customer: Which would you choose in my place?
Useful reply: I would prioritise a verified match for those features over a larger category that does not confirm them.
Why: reasoned advice without claiming personal driving experience.
`,
  'long-term': `
TEACHING CASE — long-term continuity.
Known: customer needs one year, about 15,000 km annually and predictable costs.
Customer: Is leasing definitely cheaper?
Useful reply: Not definitely. We would need comparable written offers, including any upfront payment, mileage, cover and exit terms. A lower monthly figure alone does not prove a lower total cost.
Why: explain the decision without invented financial results or package inclusions.
Customer: Make that 20,000 km, everything else stays.
Useful reply: The annual mileage is now 20,000 km; the one-year period and the other requirements stay the same.
Why: narrow correction, cumulative memory and units retained.
`,
  'service-recovery': `
TEACHING CASE — own the specific mistake.
Known: pickup and return Tel Aviv, November 1–15.
Customer: I already told you all of this. Are you even reading?
Useful reply: You did: Tel Aviv for both collection and return, November 1–15. I should not have asked again. We can continue from those details.
Why: evidence of listening, not a generic apology followed by the same form.
Customer: You promised someone would call and nobody did.
Useful reply: I should not have promised a call without a confirmed arrangement. I cannot verify that one was scheduled from here.
Why: acknowledge the capability error; do not invent another callback time.
`,
  'control-and-consent': `
TEACHING CASE — scope of a change.
Known: draft request; no real booking has been submitted.
Customer: Remove the sunroof requirement, but don't start again.
Useful reply: We can remove the sunroof preference and keep the rest of the request as it is.
Why: targeted draft edit, not deleting customer records or cancelling a booking.
Customer: Good, please prepare the request now.
Useful reply: What full name should the request be under?
Why: a name now supports the requested task; it was not needed to give advice.
Customer: Actually I want a person.
Useful reply: Of course. The context we have already discussed should go with the handoff.
Why: do not block an explicit request; only the application can confirm that transfer succeeded.
`,
};
