import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Human-authored scenario families, not scraped books or model-generated filler.
// Each prompt is combined with distinct fictional trip contexts. Counts are
// scenario variants, NOT independent articles, lessons or paid training calls.
export const families = [
  ['hebrew', 'Adapt tone without losing useful substance.',
    ['תכלס תענה לי קצר', 'בלי חפירות תעזור לי לבחור', 'דבר איתי רגיל בלי נאום', 'אפשר הסבר פשוט', 'לא הבנתי את המונח הזה', 'סבבה תודה', 'תן לי את הסיבה ולא רק רשימה', 'תסביר קצת יותר לעומק'],
    ['Please keep it short', 'Help me choose without a sales speech', 'Can you explain that plainly', 'I do not understand that term', 'Thanks, that is enough for now', 'Please explain the reason, not a list', 'Can you give a little more detail', 'Please do not use jargon']],
  ['visitors', 'Plain language; do not invent eligibility or arrangements.',
    ['אנחנו תיירים ולא מכירים איך זה עובד', 'צריך רישיון מקורי או צילום', 'אפשר גם שאשתי תנהג', 'נוחתים מאוחר מה צריך לתאם', 'מה זה השתתפות עצמית', 'איפה מקבלים את הרכב בשדה', 'האם תייר מקבל מחיר אחר', 'איך מוודאים שהמסמכים מתאימים'],
    ['We are visitors and do not know how this works', 'Do I need my original licence or a photo', 'Can my wife drive too', 'We land late, what needs arranging', 'What does excess mean', 'Where do we collect at the airport', 'Do tourists get a different price', 'How do I check the required documents']],
  ['family', 'Use actual people and luggage needs, not category guarantees.',
    ['מה אתה ממליץ עם תינוק ועגלה', 'משפחתית או גיפון לעגלה גדולה', 'שבעה מקומות אומר שיש יותר בגאז', 'איך נדע שהמזוודות ייכנסו', 'אני לא רוצה לשלם סתם על רכב גדול', 'חשובה לי כניסה נוחה לכיסא התינוק', 'יש לנו גם עגלה וגם מזוודות', 'מה חשוב לבדוק לפני שבוחרים'],
    ['What would suit us with a baby and stroller', 'Family car or SUV for a large stroller', 'Do seven seats mean more boot space', 'How do we know the cases will fit', 'I do not want a bigger car unnecessarily', 'Easy access for the child seat matters', 'We have both a stroller and cases', 'What should we check before choosing']],
  ['budget', 'Distinguish price, cash flow, deposit and value; respect limits.',
    ['יקר לי ביחס למה שקיבלתי במקום אחר', 'המחיר בסדר אבל הפיקדון בעייתי', 'אני לא רוצה למסור תקציב', 'תעזור להשוות הצעות בלי ללחוץ', 'אין לי צורך ביוקרה', 'מה חשוב להשוות במחיר הכולל', 'אפשר להסביר מה כלול בלי להמציא מחיר', 'אל תציע הנחה אם לא בדקת'],
    ['It costs more than another offer', 'The price is fine but the deposit is an issue', 'I prefer not to state my budget', 'Help me compare without pressure', 'I do not need a luxury car', 'What matters in the total price', 'Explain the inclusions without guessing a price', 'Do not offer a discount unless it is verified']],
  ['choice', 'Give a useful recommendation with qualified model-specific tradeoffs.',
    ['גיפון תמיד יותר מרווח ממשפחתית', 'כל רכב חשמלי יהיה יותר זול לשימוש', 'קרפליי כלול בכל רכב בקטגוריה', 'מה היתרון המעשי בשבילנו', 'אני רוצה נוחות ולא רשימת מפרטים', 'איך נבחר בלי להינעל על דגם', 'יותר גדול בהכרח יותר נוח', 'תגיד מה היית ממליץ לפי מה שסיפרתי'],
    ['Is an SUV always roomier than a sedan', 'Is every EV cheaper to use', 'Does every car in that category have CarPlay', 'What is the practical benefit for us', 'I want comfort, not a specification dump', 'How do we choose without fixing a model', 'Is bigger necessarily more comfortable', 'What would you recommend from what I told you']],
  ['long-term', 'Retain period, mileage, budget and equipment as separate constraints.',
    ['צריך לשנה איך משווים השכרה וליסינג', 'הקילומטר השנתי הוא לא התקציב שלי', 'התקציב החודשי כבר אמרתי', 'מה צריך לבדוק לגבי יציאה מוקדמת', 'ליסינג כולל תמיד הכל', 'אני עסק אבל לא רוצה ייעוץ מס', 'אפשר להשוות עלות כוללת בלי הצעה מאומתת', 'מה ההבדל בין תשלום חודשי לעלות הכוללת'],
    ['How do I compare yearly rental and leasing', 'My annual mileage is not my budget', 'I already gave the monthly budget', 'What should I check about early exit', 'Does leasing always include everything', 'I run a business but do not need tax advice', 'Can total cost be compared without verified offers', 'How does monthly payment differ from total cost']],
  ['service-recovery', 'Repair the specific failure and preserve context; no fake resolution.',
    ['כבר אמרתי את זה למה שוב', 'אתה בכלל קורא מה אני כותב', 'לא לזה התכוונתי', 'הבטחת שיחזרו ולא חזרו', 'התשובה שלך לא מסבירה את הבעיה', 'אל תשלח אותי להתחיל מהתחלה', 'תתקן את הטעות בלי לשאול הכל שוב', 'אני כועס כי אתה לא מקשיב'],
    ['I already told you that', 'Are you reading what I write', 'That is not what I meant', 'You promised a call that never came', 'Your answer does not explain the issue', 'Do not make me start again', 'Fix the mistake without repeating every question', 'I am frustrated because you are not listening']],
  ['existing-rental', 'Serve the existing rental; distinguish request from actual approval.',
    ['הרכב כבר אצלי אפשר להאריך', 'מה עושים בהחזרה', 'צריך להחזיר עם מיכל מלא', 'איבדתי משהו ברכב אחרי ההחזרה', 'אני צריך קבלה על ההשכרה', 'כבר אספתי לא צריך הצעת רכב חדש', 'איפה רואים מה סיכמנו בהזמנה', 'הארכה כבר אושרה או רק ביקשתי'],
    ['I already have the car, can I extend', 'What do I do at return', 'Must I return it with a full tank', 'I left something in the car after return', 'I need a rental receipt', 'I already collected it, no new quote needed', 'Where can I see the agreed booking details', 'Was the extension approved or only requested']],
  ['changes-and-cancellation', 'A hypothetical question is not an instruction; preserve unchanged facts.',
    ['מה אם אצטרך לבטל', 'שאלה על ביטול לא בקשה לביטול', 'אם הטיסה מתבטלת מה התנאים', 'אפשר לשנות תאריך בלי להתחיל הכל', 'שינוי טיוטה מבטל הזמנה אמיתית', 'איך יודעים מה סכום ההחזר', 'אל תשנה את האיסוף כשאני מדבר על החזרה', 'צריך אישור לפני שינוי הזמנה קיימת'],
    ['What if I need to cancel', 'This is a policy question, not cancellation', 'What if my flight is cancelled', 'Can a date change without restarting everything', 'Does editing a draft cancel an actual booking', 'How is an actual refund determined', 'Do not change pickup when I mean return', 'Is approval needed to amend an existing booking']],
  ['payment-clarity', 'Do not infer transaction status or ask for card secrets.',
    ['הודעת אשראי אומרת שזה חיוב סופי', 'מה ההבדל בין חסימה לחיוב', 'לשלוח לך צילום כרטיס', 'הפיקדון כבר השתחרר או רק ביקשתי', 'איך בודקים חיוב לא ברור', 'אני צריך הסבר ולא שתיקח פרטי אשראי', 'קבלה זה אותו דבר כמו אישור הזמנה', 'אפשר לדעת סטטוס החזר בלי נתוני עסקה'],
    ['Does a card notification prove a final charge', 'How is a hold different from a charge', 'Should I send a card photo', 'Was the hold released or only requested', 'How can an unclear charge be checked', 'I need an explanation, not card collection', 'Is a receipt the same as booking confirmation', 'Can a refund status be known without transaction data']],
  ['accessible-service', 'Ask practical access needs, not diagnoses; do not invent adapted stock.',
    ['קשה להיכנס לרכב גבוה', 'אפשר הסבר קצר וקל לקריאה', 'צריך מקום להליכון', 'אל תדבר רק עם המלווה שלי', 'רכב גבוה זה בהכרח יותר נגיש', 'מה צריך לבדוק בדלת ובמושב', 'אני מעדיף להמשיך בכתב', 'אפשר לעזור בלי לבקש מידע רפואי'],
    ['A high vehicle is hard to get into', 'Please use short easy-to-read wording', 'We need room for a walker', 'Please speak to me, not only my companion', 'Is a high car necessarily more accessible', 'What matters about the door and seat', 'I prefer to continue in writing', 'Can you help without asking for medical details']],
  ['urgent-service', 'Current danger and hypothetical policy are different; use approved safety paths.',
    ['מה עושים אם יש תקלה בדרך', 'אני תקוע עכשיו והרכב לא מניע', 'יש עשן מהרכב עכשיו', 'מה אם תהיה תאונה', 'אל תשלח תפריט כשאני תקוע', 'מישהו כבר נשלח או שאין אישור', 'יש זמן הגעה מאומת לסיוע', 'אפשר להסביר שירות דרך בלי להמציא חילוץ'],
    ['What happens if there is a breakdown', 'We are stranded now and the car will not start', 'There is smoke from the car now', 'What if there is an accident', 'Do not send a menu while we are stranded', 'Was help actually dispatched or not confirmed', 'Is there a verified arrival estimate', 'Explain roadside support without inventing a dispatch']],
  ['continuity', 'Recall actual cumulative facts, corrections and refusals after interruptions.',
    ['תזכיר מה כבר אמרתי', 'נמשיך מאיפה שהיינו', 'השאלה על הסניף לא שינתה את הבקשה', 'מה נשאר אחרי התיקון האחרון', 'אמרתי לא לשאול תקציב שוב', 'אל תשכח את מה שסיכמנו קודם', 'התכוונתי לאותה החזרה שדיברנו', 'רגע שאלתי משהו אחר ועכשיו חוזרים'],
    ['Remind me what I already told you', 'Let us continue where we left off', 'The branch question did not replace my request', 'What remains after the last correction', 'I asked not to repeat the budget question', 'Do not forget the earlier agreement', 'I mean the same return place we discussed', 'That was a side question, now back to the request']],
  ['ambiguity', 'Resolve only decision-changing ambiguity using actual context.',
    ['מה עם האפשרות השנייה', 'לא זה השני שהתכוונתי', 'אולי אבל עוד לא בחרתי', 'שניהם נשמעים מתאימים אז מה מכריע', 'מספר הקילומטרים לא סכום כסף', 'אפשר לבחור לפי מה שכבר ידוע', 'אין לי העדפה ברורה עדיין', 'אל תנחש כשיש שתי אפשרויות'],
    ['What about the second option', 'That is not the second one I meant', 'Maybe, but I have not chosen', 'Both sound suitable, what decides it', 'That number was mileage, not money', 'Can you advise from what is already known', 'I do not have a clear preference yet', 'Do not guess when there are two possible meanings']],
  ['closing-and-follow-through', 'Consent has a scope; preparation is not payment or confirmation.',
    ['נשמע טוב אבל עוד לא החלטתי', 'תכין את הבקשה עם הפרטים שכבר נתתי', 'אל תחייב שום דבר עדיין', 'מה בדיוק אושר עד עכשיו', 'שלחת באמת או רק כתבת שתשלח', 'למה לבקש שוב פרטים שכבר יש', 'אישור הצעה זה אותו דבר כמו תשלום', 'מה השלב הבא האמיתי בלי הבטחות'],
    ['Sounds good but I have not decided', 'Prepare the request from my existing details', 'Do not charge anything yet', 'What exactly has been approved so far', 'Was it actually sent or merely promised', 'Why ask for details already retained', 'Is accepting an idea the same as payment', 'What is the actual next step without promises']],
  ['control-and-consent', 'Clarify the scope of edits; respect refusal and explicit human requests.',
    ['אל תאפס רק תשנה פרט', 'איך מתחילים מחדש בלי לבטל הזמנה', 'תמחק רק את העדפת האבזור', 'תודה אני לא ממשיך עכשיו', 'אני רוצה נציג אנושי', 'אפשר לערוך בקשה בלי למחוק הכל', 'אל תמחק כלום זו רק שאלה', 'תשאיר את הפרט הקודם כמו שהוא'],
    ['Do not reset, just change one detail', 'How do I restart chat without cancelling a booking', 'Forget only the equipment preference', 'Thanks, I am not proceeding now', 'I want a human representative', 'Can a request be edited without deleting everything', 'Do not delete anything, this is only a question', 'Keep the previous detail unchanged']],
];

export function generateAcademy() {
  const training = [], heldout = [];
  for (let p = 0; p < 16; p++) {
    const start = new Date(Date.UTC(2030, p % 4, 1 + p));
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 7 + p % 4);
    const places = ['תל אביב', 'הרצליה', 'ירושלים', 'נתב״ג'];
    const known = { pickupDate: start.toISOString().slice(0, 10), dropoffDate: end.toISOString().slice(0, 10), pickupLocation: places[p % 4], dropoffLocation: places[(p + 1) % 4], passengers: 3, luggage: p % 4, budget: p % 4 === 0 ? 'declined' : String(2000 + p * 200), annualKm: 15000 + p * 1000 };
    for (const [topic, principle, he, en] of families) {
      for (const [locale, messages] of [['he', he], ['en', en]]) {
        messages.forEach((message, m) => {
          const item = { id: `${topic}-${locale}-p${p}-m${m}`, topic, locale, profile: p, message, known, principle,
            avoid: ['invented availability or action', 'unsolicited inventory/URL', 'repeating known questions', 'treating advice as consent'] };
          (p < 12 ? training : heldout).push(item);
        });
      }
    }
  }
  return { training, heldout };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bank = generateAcademy();
  writeFileSync(new URL('../../src/lib/whatsapp-academy-bank.json', import.meta.url), JSON.stringify(bank.training));
  writeFileSync(new URL('./academy-heldout.json', import.meta.url), JSON.stringify(bank.heldout));
  process.stdout.write(JSON.stringify({ training: bank.training.length, heldout: bank.heldout.length, families: families.length, variantsPerLanguage: 128, description: 'Synthetic scenario variants, not independent lessons/articles or model-weight training' }) + '\n');
}
