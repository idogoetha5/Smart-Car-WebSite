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

// Actual customer-facing simulator requests, with real Gemini readings. No
// WhatsApp transport, customer DB write or fake provider reading is involved.
// The 15 initial archetypes are expanded through varied corrections, questions,
// language and branch details. This is a first volume pass, not human review.
const RESULT_FILE = resolve(process.env.SMARTCAR_EVAL_RESULTS ?? 'evidence/whatsapp-live-1500.jsonl');
const DELAY_MS = 20_000; // 180 requests/hour, below the public 200/hour limit.
const MAX_CASES = Number(process.env.SMARTCAR_EVAL_MAX_CASES ?? 1500);
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const cities = ['תל אביב', 'הרצליה', 'ירושלים', 'נתבג', 'רמת גן', 'פתח תקווה', 'חיפה', 'נתניה', 'ראשון לציון', 'רעננה'];
const followUps = {
  rental: ['מה עם ביטוח?', 'האם אפשר לשנות תאריך בהמשך?', 'יש אפשרות להוסיף נהג?', 'איך עובד התשלום?', 'אני עדיין מתלבט על הדגם'],
  commercial: ['מה כולל השירות?', 'איך אני מקבל הצעה?', 'מה צריך בשביל להתקדם?', 'יש אפשרות לראות את הרכב?', 'אפשר לדבר עם מישהו?'],
  service: ['מה הצעד הבא?', 'אני צריך עזרה היום', 'יש משהו שכדאי להכין?', 'תוכלו לחזור אליי?', 'אני עדיין מחכה לתשובה'],
};

function variant(index) {
  const [name, original] = cases[index % cases.length];
  const cycle = Math.floor(index / cases.length);
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
  const category = index % cases.length < 6 || index % cases.length === 8 ? 'rental'
    : index % cases.length < 12 ? 'commercial' : 'service';
  const extras = followUps[category];
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
  if (!rows.some(row => row.model)) issues.push('no_gemini_reading');
  if (replies.some(reply => /באיזו שעה|באיזה שעה|what time/i.test(reply))) issues.push('asked_pickup_hour');
  if (replies.some((reply, index) => /המחיר באתר|אין לי גישה|המודל|כיוון לבדיקה|website price|internal process/i.test(reply)
    || /סימולציה|simulation/i.test(reply) && index !== replies.length - 1)) issues.push('internal_language');
  for (let i = 1; i < replies.length; i++) if (replies[i] === replies[i - 1]) issues.push('adjacent_repeat');
  if (category === 'rental' && /^(solo_screenshot|family_advice|city_advice|rental_|leasing_switch)/.test(last?.name ?? '') && !last?.completedRequestId && /אני מאשר/.test(rows.at(-1)?.message ?? '')) issues.push('rental_not_completed');
  if (category === 'commercial' && !last?.handedOff) issues.push('commercial_not_handed_off');
  return [...new Set(issues)];
}

async function run() {
  mkdirSync(resolve(RESULT_FILE, '..'), { recursive: true });
  const finished = new Set(existsSync(RESULT_FILE)
    ? readFileSync(RESULT_FILE, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line).index) : []);
  for (let index = 0; index < MAX_CASES; index++) {
    if (finished.has(index)) continue;
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
        console.log(`Rate limit at case ${index + 1}; waiting one hour`);
        await sleep(60 * 60_000);
        turn--;
        continue;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { rows.push({ name, turn: turn + 1, message: messages[turn], status: response.status, error: data.error }); break; }
      state = data.state;
      rows.push({ name, turn: turn + 1, message: messages[turn], reply: data.reply, source: data.source, model: data.model, phase: state?.phase, step: state?.step, booking: state?.booking, handedOff: state?.handedOff, handoffKind: state?.handoffKind, completedRequestId: state?.completedRequestId });
      await sleep(DELAY_MS);
    }
    const record = { index, name, cycle, category, turns: rows.length, geminiReadings: rows.filter(row => row.model).length, issues: findings(rows, category), rows, finishedAt: new Date().toISOString() };
    appendFileSync(RESULT_FILE, JSON.stringify(record) + '\n', { mode: 0o600 });
    console.log(`${index + 1}/${MAX_CASES} ${name}: ${record.turns} turns, ${record.geminiReadings} Gemini, ${record.issues.join(',') || 'no automatic issue'}`);
    if (record.issues.includes('http_failure')) break;
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
