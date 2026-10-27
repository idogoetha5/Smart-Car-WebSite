import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const cases = [
  ['solo_screenshot', ['היי', 'היי', 'נעים מאוד', 'מה אתה ממליץ לאדם אחד לשבוע', '25/11-16/1', 'תל אביב גם להחזיר גם לאסוף', 'מה אתה ממליץ לאדם אחד', 'לא יודע', 'אתה סוגר לי רכב?', 'כן', '24+', 'נועה כהן', 'noa@example.invalid', 'אני מאשרת']],
  ['family_advice', ['שלום', 'אנחנו חמישה עם שלוש מזוודות, שני ילדים, מה מתאים?', 'זה באמת יספיק למזוודות?', 'רוצים מ-15/12 עד 19/12', 'איסוף מהרצליה והחזרה בתל אביב', 'אני רוצה לשכור', '24+', 'מאיה לוי', 'maya@example.invalid', 'אני מאשרת']],
  ['city_advice', ['היי', 'נוסע אחד לעבודה בעיר. איזה רכב כדאי?', 'אני לא בטוח בתאריכים', 'אין בעיה, מה חשוב לבדוק ברכב קטן?', 'אני רוצה לשכור רכב', '10/12-14/12', 'איסוף בתל אביב והחזרה בתל אביב', '24+', 'אורי ישראלי', 'ori@example.invalid', 'אני מאשר']],
  ['rental_direct', ['היי', 'אני רוצה לשכור רכב משפחתי 10/12-14/12', 'איסוף מהרצליה והחזרה בנתבג', 'כמה יעלה?', '24+', 'רותם כהן', 'rotem@example.invalid', 'אני מאשר']],
  ['rental_correction', ['שלום', 'רוצה לשכור רכב קטן 12/12-16/12', 'בעצם מעדיף רכב פנאי', 'איסוף מתל אביב והחזרה בהרצליה', 'אני בן 23', 'דני לביא', 'dani@example.invalid', 'אני מאשר']],
  ['rental_uncertain', ['שלום', 'אני שוקל השכרה בשבוע הבא', 'מה תציעו לי?', 'אנחנו זוג עם מזוודה', 'אני רוצה לשכור', '10/12-14/12', 'איסוף מהרצליה והחזרה בהרצליה', 'רכב קטן', '24+', 'טל ישראלי', 'tal@example.invalid', 'אני מאשר']],
  ['leasing_private', ['היי', 'מחפש ליסינג פרטי לשנתיים, 20 אלף קמ בשנה, רכב קטן', 'כמה זה עולה בחודש?', 'מה כלול?', 'כן תתקדמו עם הצעה', 'מתי יחזרו אליי?']],
  ['leasing_business', ['שלום', 'אני רוצה ליסינג עסקי', 'לשלוש שנים', '25 אלף קמ בשנה', 'רכב משפחתי', 'יש תשלום ראשוני?', 'תעבירו לנציג בבקשה']],
  ['leasing_switch', ['שלום', 'מה ההבדל בין ליסינג פרטי להשכרה?', 'נראה לי עדיף לי לשכור לחודש', 'אני רוצה לשכור רכב קטן', '10/12-20/12', 'איסוף מתל אביב והחזרה בהרצליה', '24+', 'אייל לוי', 'eyal@example.invalid', 'אני מאשר']],
  ['sale_family', ['היי', 'אני רוצה לקנות רכב משפחתי עד 80 אלף שקל', 'מה יש לכם?', 'יש רכב זמין עכשיו?', 'אפשר נסיעת מבחן?', 'תעבירו לנציג שיחזור אליי']],
  ['sale_used', ['שלום', 'מחפש רכב משומש לקנייה', 'משפחתי בתקציב 70 אלף', 'מה האפשרויות?', 'כן, תתקדמו', 'מתי יחזרו אליי?']],
  ['sale_price', ['היי', 'אני רוצה לקנות רכב פנאי', 'מה המחיר?', 'יש משהו עד 100 אלף?', 'איך קובעים נסיעת מבחן?', 'אני רוצה שיחזרו אליי']],
  ['accident', ['שלום', 'הייתה לי תאונה עם הרכב השכור', 'אני במקום בטוח', 'צריך גרר', 'יש לי מספר הזמנה 123456', 'מתי יחזרו אליי?']],
  ['breakdown', ['שלום', 'הרכב לא מניע ואני בצד הדרך', 'צריך גרר', 'אני במקום בטוח', 'הכתובת היא תל אביב', 'תודה']],
  ['service', ['שלום', 'אני רוצה לבטל את ההזמנה שלי', 'מספר הזמנה 123456', 'בנוסף חויבתי פעמיים', 'מתי יחזרו אליי?', 'תודה']],
];

// Different customer journeys, not only permutations of the first 15.
const extraCases = [
  ['rental_airport_family', ['היי', 'אנחנו ארבעה עם שתי מזוודות ומחפשים רכב לשבוע', 'איזה גודל תמליצו?', 'רוצים 11/12-18/12', 'איסוף בנתבג והחזרה בתל אביב', 'אני רוצה להתקדם', '24+', 'שני כהן', 'shani@example.invalid', 'אני מאשרת'], 'rental'],
  ['rental_young_driver', ['שלום', 'אני בן 23 ורוצה לשכור רכב קטן', 'יש מגבלה על הגיל שלי?', '12/12-16/12', 'איסוף מתל אביב והחזרה בתל אביב', 'אני רוצה לשלוח בקשה', '21-23', 'איתן לוי', 'eitan@example.invalid', 'אני מאשר'], 'rental'],
  ['rental_seven_seats', ['היי', 'אנחנו שישה עם שלוש מזוודות', 'צריך שבעה מקומות?', 'רוצה לשכור רכב מתאים', '10/12-15/12', 'איסוף מהרצליה והחזרה בהרצליה', '24+', 'דנה ישראלי', 'dana@example.invalid', 'אני מאשרת'], 'rental'],
  ['rental_vehicle_change', ['שלום', 'אני צריך רכב קטן 10/12-14/12', 'איסוף מתל אביב והחזרה בהרצליה', 'בעצם רכב משפחתי עדיף לנו', 'אני רוצה לסיים את הבקשה', '24+', 'יוסי כהן', 'yossi@example.invalid', 'אני מאשר'], 'rental'],
  ['rental_budget_question', ['היי', 'אני רוצה לשכור רכב פנאי לשבוע', 'יש לכם מחיר?', 'אפשר לקבל הצעה מסודרת?', '11/12-18/12', 'איסוף מירושלים והחזרה בתל אביב', '24+', 'רוני לוי', 'roni@example.invalid', 'אני מאשר'], 'rental'],
  ['rental_same_place', ['שלום', 'רוצה רכב משפחתי לתאריכים 10/12-14/12', 'מאיפה אפשר לאסוף?', 'הרצליה', 'להחזיר לאותו מקום', 'אני רוצה להתקדם', '24+', 'ניר כהן', 'nir@example.invalid', 'אני מאשר'], 'rental'],
  ['rental_confirm_correction', ['היי', 'אני רוצה לשכור רכב קטן 10/12-14/12', 'איסוף מתל אביב והחזרה בהרצליה', '24+', 'אור לוי', 'or@example.invalid', 'רגע, מעדיף רכב משפחתי', 'אני מאשר'], 'rental'],
  ['rental_two_questions', ['שלום', 'רוצה רכב למשפחה עם ילד וכיסא בטיחות', 'מה כדאי וגם מה עם הביטוח?', 'אני רוצה לשכור', '10/12-14/12', 'איסוף מתל אביב והחזרה בהרצליה', '24+', 'ענבר כהן', 'inbar@example.invalid', 'אני מאשרת'], 'rental'],
  ['rental_english', ['Hi', 'I need a compact rental car for one person', 'How does insurance work?', 'Pickup 10/12 and return 14/12', 'Pickup in Tel Aviv and return in Herzliya', 'I would like to make a request', '24+', 'Noa Cohen', 'noa@example.invalid', 'I confirm'], 'rental'],
  ['advice_no_dates', ['היי', 'אני מתלבט איזה רכב לשכור', 'אנחנו זוג עם תינוק ומזוודה', 'מה מתאים לנו?', 'אין לי עדיין תאריכים', 'אפשר להוסיף כיסא בטיחות?', 'היית ממליץ על קטן?', 'תודה, אעדכן כשאדע תאריכים'], 'advice'],
  ['advice_solo_city', ['שלום', 'אני נוסע בעיקר בעיר לבד', 'קטן או משפחתי?', 'ומה לגבי חניה?', 'אולי אשכור בסוף החודש', 'אין תאריך סופי', 'מה צריך כדי לקבל הצעה?', 'תודה'], 'advice'],
  ['advice_luggage_fit', ['היי', 'אנחנו חמישה ושלוש מזוודות', 'האם גיפון יתאים?', 'המזוודות גדולות', 'אז מה היית מציע?', 'לא רוצה להזמין עדיין', 'איך נוודא מקום למטען?', 'תודה'], 'advice'],
  ['advice_one_day', ['שלום', 'צריך רכב ליום אחד לעבודה', 'רכב קטן יספיק?', 'אני נוסע לבד', 'יש גם תיק אחד', 'מה לגבי ביטוח?', 'אחזור עם תאריך', 'תודה רבה'], 'advice'],
  ['advice_price_objection', ['היי', 'מחפש רכב זול לשבוע', 'מה תציעו לי?', 'אני נוסע לבד', 'זה נשמע יקר', 'עוד אין לי תאריכים', 'איזו קבוצה הכי מתאימה?', 'אחשוב על זה'], 'advice'],
  ['leasing_private_long', ['שלום', 'אני בודק ליסינג פרטי', 'לשנתיים', 'בערך 18 אלף קמ בשנה', 'רכב משפחתי', 'מה כלול?', 'כמה עולה?', 'תעבירו לנציג להכין הצעה', 'ומה עם תשלום ראשוני?'], 'commercial'],
  ['leasing_business_terms', ['היי', 'מחפש ליסינג לעסק', 'לשלוש שנים', 'בערך 30 אלף קמ', 'רכב פנאי', 'יש מקדמה?', 'מה צריך כדי להתקדם?', 'כן, תעבירו להצעה'], 'commercial'],
  ['leasing_unsure_type', ['שלום', 'אולי ליסינג פרטי', 'מה ההבדל מהשכרה?', 'אני צריך רכב לשנתיים', '20 אלף קמ בשנה', 'לא יודע איזה סוג רכב', 'מה אתה ממליץ?', 'תעביר לנציג שידבר איתי'], 'commercial'],
  ['leasing_price_push', ['היי', 'ליסינג לרכב קטן לשלוש שנים', '20 אלף קמ בשנה', 'תן לי מחיר חודשי', 'מה כלול במחיר?', 'יש תשלום ראשוני?', 'אפשר לקבל הצעה?', 'כן, נציג יכול לחזור אליי'], 'commercial'],
  ['leasing_after_handoff', ['שלום', 'אני רוצה ליסינג פרטי לשנתיים', '15 אלף קמ בשנה', 'רכב קטן', 'תעבירו לנציג', 'רגע, יש תשלום ראשוני?', 'ואם ארצה רכב משפחתי?', 'מתי חוזרים?'], 'commercial'],
  ['sale_budget_family', ['היי', 'אני רוצה לקנות רכב משפחתי', 'תקציב עד 90 אלף שקל', 'מה יש לכם?', 'יש משהו זמין?', 'מה כולל השירות?', 'אפשר נסיעת מבחן?', 'תעביר לנציג עם הפרטים'], 'commercial'],
  ['sale_used_city', ['שלום', 'מחפש רכב משומש קטן', 'עד 60 אלף', 'איזה דגמים?', 'חשוב לי קילומטראז נמוך', 'יש מחיר סופי?', 'מה השלב הבא?', 'כן, שיחזרו אליי'], 'commercial'],
  ['sale_suv', ['היי', 'רוצה לקנות רכב פנאי', 'מה המחיר?', 'התקציב שלי 110 אלף', 'אפשר לראות אותו?', 'איך מתאמים נסיעת מבחן?', 'תעבירו את הבקשה', 'תודה'], 'commercial'],
  ['sale_no_budget', ['שלום', 'אני חושב לקנות רכב', 'לא החלטתי על סוג', 'מה אתה מציע למשפחה?', 'יש רכב זמין עכשיו?', 'התקציב סביב 80 אלף', 'רכב משפחתי', 'תעביר לנציג שיעזור לי'], 'commercial'],
  ['service_change_date', ['שלום', 'יש לי הזמנה קיימת', 'רוצה לדחות את ההחזרה ביום', 'מספר ההזמנה 123456', 'זה כבר מאושר?', 'מה צריך להכין?', 'מתי יחזרו אליי?', 'תודה'], 'service'],
  ['service_double_charge', ['היי', 'חויבתי פעמיים על השכרה', 'יש לי מספר הזמנה 123456', 'מה עושים עכשיו?', 'אני יכול לשלוח אסמכתא', 'כמה זמן לוקח לבדוק?', 'תעבירו לנציג', 'תודה'], 'service'],
  ['service_dirty_car', ['שלום', 'הרכב ששכרתי היה מלוכלך', 'מספר הזמנה 123456', 'מה תעשו עם זה?', 'אפשר לדבר עם נציג?', 'אני צריך פתרון היום', 'מתי תחזרו אליי?', 'תודה'], 'service'],
  ['service_cancel', ['היי', 'אני רוצה לבטל הזמנה', 'מספר הזמנה 123456', 'האם הביטול נכנס לתוקף?', 'מה הצעד הבא?', 'יש גם חיוב שאני רוצה לבדוק', 'מתי נציג יחזור?', 'תודה'], 'service'],
  ['accident_followup', ['שלום', 'הרכב השכור עבר תאונה', 'אין נפגעים ואני במקום בטוח', 'מה הצעד הבא?', 'צריך גרר', 'מה כדאי להכין?', 'מספר הזמנה 123456', 'מתי יחזרו אליי?'], 'service'],
  ['breakdown_location', ['היי', 'הרכב לא מניע בצד הדרך', 'אני במקום בטוח', 'צריך עזרה', 'מה הצעד הבא?', 'אני בתל אביב ליד התחנה', 'מספר הזמנה 123456', 'תודה'], 'service'],
];
const scenarios = cases.map(([name, messages], index) => [name, messages, index < 6 || index === 8 ? 'rental' : index < 12 ? 'commercial' : 'service']).concat(extraCases);

// Actual customer-facing simulator requests, with real Gemini readings. No
// WhatsApp transport, customer DB write or fake provider reading is involved.
// The 15 initial archetypes are expanded through varied corrections, questions,
// language and branch details. This is a first volume pass, not human review.
const RESULT_FILE = resolve(process.env.SMARTCAR_EVAL_RESULTS ?? 'evidence/whatsapp-live-1500.jsonl');
const DELAY_MS = Math.max(0, Number(process.env.SMARTCAR_EVAL_DELAY_MS ?? 20_000)); // Default: 180 requests/hour, below the public 200/hour limit.
const START_INDEX = Math.max(0, Number(process.env.SMARTCAR_EVAL_START_INDEX ?? 0));
const MAX_CASES = Number(process.env.SMARTCAR_EVAL_MAX_CASES ?? 1500);
const MAX_TURNS = Number(process.env.SMARTCAR_EVAL_MAX_TURNS ?? Number.POSITIVE_INFINITY);
const RELEASE = process.env.SMARTCAR_EVAL_RELEASE ?? 'unknown';
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const cities = ['תל אביב', 'הרצליה', 'ירושלים', 'נתבג', 'רמת גן', 'פתח תקווה', 'חיפה', 'נתניה', 'ראשון לציון', 'רעננה'];
const followUps = {
  rental: ['מה עם ביטוח?', 'האם אפשר לשנות תאריך בהמשך?', 'יש אפשרות להוסיף נהג?', 'איך עובד התשלום?', 'אני עדיין מתלבט על הדגם'],
  commercial: ['מה כולל השירות?', 'איך אני מקבל הצעה?', 'מה צריך בשביל להתקדם?', 'יש אפשרות לראות את הרכב?', 'אפשר לדבר עם מישהו?'],
  service: ['מה הצעד הבא?', 'אני צריך עזרה היום', 'יש משהו שכדאי להכין?', 'תוכלו לחזור אליי?', 'אני עדיין מחכה לתשובה'],
  advice: ['מה הכי מתאים לדעתך?', 'מה לגבי ביטוח?', 'אולי יש כיוון אחר?', 'אני עדיין לא בטוח', 'אפשר להמשיך אחר כך?'],
};
const followUpsEnglish = {
  rental: ['What about insurance?', 'Can I add another driver?', 'How does payment work?', 'I might change the dates', 'What happens next?'],
};

function variant(index) {
  const [name, original, category] = scenarios[index % scenarios.length];
  const cycle = Math.floor(index / scenarios.length);
  const city = cities[cycle % cities.length];
  const city2 = cities[(cycle * 3 + 1) % cities.length];
  const replacements = [
    [/תל אביב/g, city], [/הרצליה/g, city2],
    [/10\/12-14\/12/g, `${10 + cycle % 8}/12-${14 + cycle % 8}/12`],
    [/15\/12 עד 19\/12/g, `${10 + cycle % 8}/12 עד ${14 + cycle % 8}/12`],
    [/25\/11-16\/1/g, `${25 + cycle % 3}/11-16/1`],
    [/noa@example\.invalid/g, `noa${index}@example.invalid`],
  ];
  let messages = original.map(message => replacements.reduce((text, [pattern, next]) => text.replace(pattern, next), message));
  const extras = /^[A-Za-z]/.test(messages[0]) ? followUpsEnglish.rental : followUps[category];
  // Insert realistic side questions before the customer gives their last detail.
  const insertion = Math.min(3, messages.length - 2);
  messages.splice(insertion, 0, extras[cycle % extras.length]);
  if (cycle % 3 === 0) messages.splice(Math.min(5, messages.length - 1), 0, extras[(cycle + 2) % extras.length]);
  while (messages.length < 8) messages.splice(messages.length - 1, 0, extras[(cycle + messages.length) % extras.length]);
  return { name, messages, category, cycle };
}

function findings(rows, category) {
  const issues = [];
  const replies = rows.filter(row => row.reply).map(row => row.reply.trim());
  const last = rows.at(-1);
  if (rows.some(row => row.status && row.status !== 200)) issues.push('http_failure');
  if (category !== 'service' && !rows.some(row => row.model)) issues.push('no_gemini_reading');
  if (replies.some(reply => /באיזו שעה|באיזה שעה|what time/i.test(reply))) issues.push('asked_pickup_hour');
  if (category === 'commercial' && replies.some(reply => /תאריכי האיסוף וההחזרה|התאריכים המדויקים|pickup and return dates/i.test(reply))) issues.push('commercial_rental_date_drift');
  if (replies.some(reply => /(?:חיסכון|חסכון).{0,18}בדלק|fuel savings|great fuel efficiency/i.test(reply))) issues.push('unsupported_fuel_claim');
  if (replies.some(reply => /(?:יהיה|תהיה).{0,35}(?:נוח|נוחה|מרווח|מרווחת|מספיק מרחב|מספיק מקום).{0,45}(?:לכל|ל)(?:\s+ה)?(?:נוסעים|מטען|מזוודות)/i.test(reply))) issues.push('unsupported_fit_claim');
  if (replies.some((reply, index) => /המחיר באתר|אין לי גישה|המודל|כיוון לבדיקה|website price|internal process/i.test(reply)
    || /סימולציה|simulation/i.test(reply) && index !== replies.length - 1)) issues.push('internal_language');
  for (let i = 1; i < replies.length; i++) if (replies[i] === replies[i - 1]) issues.push('adjacent_repeat');
  if (replies.some(reply => replies.filter(other => other === reply).length >= 3)) issues.push('repeated_reply_three_times');
  if (category === 'rental' && /^(solo_screenshot|family_advice|city_advice|rental_|leasing_switch)/.test(last?.name ?? '') && !last?.completedRequestId && /אני מאשר|i confirm/i.test(rows.at(-1)?.message ?? '')) issues.push('rental_not_completed');
  if (category === 'commercial' && !last?.handedOff) issues.push('commercial_not_handed_off');
  if (category === 'service' && !last?.handedOff) issues.push('service_not_handed_off');
  return [...new Set(issues)];
}

async function run() {
  mkdirSync(resolve(RESULT_FILE, '..'), { recursive: true });
  const finished = new Set(existsSync(RESULT_FILE)
    ? readFileSync(RESULT_FILE, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(record => record.release === RELEASE && record.turns >= 8 && record.issues.length === 0).map(record => record.index) : []);
  let turnsThisRun = 0;
  for (let index = START_INDEX; index < MAX_CASES; index++) {
    if (finished.has(index)) continue;
    if (turnsThisRun >= MAX_TURNS) break;
    const { name, messages, category, cycle } = variant(index);
    let state = null;
    const sessionId = `codex${randomUUID().replaceAll('-', '').slice(0, 24)}`;
    const rows = [];
    for (let turn = 0; turn < messages.length; turn++) {
      let response;
      try {
        response = await fetch('https://www.smartcar.co.il/api/whatsapp/simulator', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, message: messages[turn], state }),
          signal: AbortSignal.timeout(25_000),
        });
      } catch (error) {
        rows.push({ name, turn: turn + 1, message: messages[turn], status: 0, error: String(error) });
        break;
      }
      if (response.status === 429) {
        rows.push({ name, turn: turn + 1, message: messages[turn], status: 429, error: 'Public simulator hourly limit reached' });
        break;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { rows.push({ name, turn: turn + 1, message: messages[turn], status: response.status, error: data.error }); break; }
      state = data.state;
      rows.push({ name, turn: turn + 1, message: messages[turn], reply: data.reply, source: data.source, model: data.model, phase: state?.phase, step: state?.step, booking: state?.booking, handedOff: state?.handedOff, handoffKind: state?.handoffKind, completedRequestId: state?.completedRequestId });
      await sleep(DELAY_MS);
    }
    const record = { index, name, cycle, category, release: RELEASE, turns: rows.length, geminiReadings: rows.filter(row => row.model).length, issues: findings(rows, category), rows, finishedAt: new Date().toISOString() };
    appendFileSync(RESULT_FILE, JSON.stringify(record) + '\n', { mode: 0o600 });
    turnsThisRun += rows.length;
    console.log(`${index + 1}/${MAX_CASES} ${name}: ${record.turns} turns, ${record.geminiReadings} Gemini, ${record.issues.join(',') || 'no automatic issue'}`);
    if (record.issues.length) break;
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
