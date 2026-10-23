import { writeFileSync } from 'node:fs';

const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const base = option('base', 'http://localhost:3007').replace(/\/$/, '');
if (!/^https:\/\/(?:www\.)?smartcar\.co\.il$|^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Use the isolated simulator only');
const trip = { step: 'rental_vehicle', locale: 'he', pickupDate: '2030-02-02', dropoffDate: '2030-02-16', pickupLocation: 'תל אביב', dropoffLocation: 'תל אביב' };
const stories = [
  { id: 'family', state: trip, turns: [
    ['מה אתה ממליץ לזוג ותינוק עם עגלה?', 'rental_vehicle'],
    ['אני רק מתעניין, לא צריך גיפון אם אין סיבה', 'rental_vehicle'],
    ['יש עגלה גדולה ושתי מזוודות', 'rental_vehicle'],
    ['בלי עוד שאלות כרגע תסביר מה באמת חשוב בהתאמה', 'rental_vehicle'],
    ['ומה כבר ידוע על התאריכים והמיקום שלי?', 'rental_vehicle'],
    ['אני לא רוצה לתת שם כרגע, זה מונע ממך לייעץ?', 'rental_vehicle'],
  ] },
  { id: 'visitor', state: { step: 'menu', locale: 'en' }, turns: [
    ['We are a couple with a baby, a stroller and two cases. What would you recommend?', 'menu'],
    ['We are only comparing, not booking. What does excess mean?', 'menu'],
    ['Is that the same as the deposit?', 'menu'],
    ['Would my wife be able to drive too?', 'menu'],
    ['I prefer not to give a budget yet. What matters in comparing the offers?', 'menu'],
    ['Please remind me of our practical needs, not all the rental rules.', 'menu'],
  ] },
  { id: 'year', state: { step: 'menu', locale: 'he' }, turns: [
    ['אני צריך רכב לשנה, עוד מתלבט בין השכרה ארוכה לליסינג', 'menu'],
    ['בערך 15000 קילומטר בשנה', 'menu'],
    ['עד 3000 בחודש וחשוב לי קרפליי וגג נפתח', 'menu'],
    ['ליסינג תמיד כולל טיפולים וביטוח או צריך לבדוק?', 'menu'],
    ['רק לתקן את הקילומטר: 20000 בשנה, כל השאר אותו דבר', null],
    ['תזכיר את כל הדרישות שלי אחרי התיקון', null],
  ] },
];

const report = { base, started: new Date().toISOString(), description: 'Fictional live model rehearsal; heuristic gates are not a human-quality score.', turns: [], failures: [] };
for (const story of stories) {
  if (option('story', 'all') !== 'all' && option('story', 'all') !== story.id) continue;
  let state = structuredClone(story.state);
  const sessionId = `academy-${story.id}-${Date.now()}`;
  for (const [message, expectedStep] of story.turns) {
    const response = await fetch(`${base}/api/whatsapp/simulator`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-smartcar-debug': '1' }, body: JSON.stringify({ sessionId, message, state }), signal: AbortSignal.timeout(45000) });
    const result = await response.json();
    state = result.state;
    const failures = [];
    if (response.status !== 200 || !result.reply?.trim()) failures.push('missing reply');
    if (/https?:\/\/|\/rental\/|כמעט סיימנו/.test(result.reply ?? '')) failures.push('unsolicited link or closing script');
    if (result.escalated) failures.push('unexpected handoff');
    if (expectedStep && state?.step !== expectedStep) failures.push(`step ${state?.step}, wanted ${expectedStep}`);
    if ((result.reply?.match(/\?/g) ?? []).length > 1) failures.push('multiple questions');
    if (story.id === 'visitor' && /[א-ת]/.test(result.reply ?? '')) failures.push('wrong language');
    if (story.id === 'family' && state?.vehiclePreference) failures.push('advice recorded as category selection');
    if (expectedStep && (result.understood?.source !== 'gemini' || !result.understood?.reply)) failures.push('no accepted Gemini reply');
    const row = { story: story.id, message, status: response.status, reply: result.reply, source: result.understood?.source, purpose: result.understood?.purpose, state, rawReply: result.understood?.rawReply, failures };
    report.turns.push(row);
    report.failures.push(...failures.map(failure => ({ story: story.id, message, failure })));
    process.stdout.write(JSON.stringify({ story: story.id, message, reply: row.reply, source: row.source, purpose: row.purpose, step: state?.step, failures }) + '\n');
    // Stop at a confirmed broken boundary, fix it, then repeat only that story.
    if (failures.length) break;
  }
  if (report.failures.length) break;
}
writeFileSync(option('out', '/tmp/smartcar-academy-live.json'), JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;
