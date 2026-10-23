import type { FlowState } from '@/lib/whatsapp-flow';

export type EditableFact = 'customerEmail' | 'customerName' | 'dates' | 'pickupDate' | 'dropoffDate' | 'pickupLocation' | 'dropoffLocation' | 'vehiclePreference' | 'passengers' | 'luggage' | 'budget' | 'annualKm' | 'equipment';
export type ControlAction = { kind: 'reset' } | { kind: 'external' } | { kind: 'forget' | 'edit'; fields: EditableFact[] };

const FIELDS: Array<[EditableFact, RegExp]> = [
  ['customerEmail', /מייל|דוא[״"]?ל|email|e-mail/i],
  ['customerName', /(?:^|\s)(?:השם|שם|name)(?=\s|$|[,.!?])/i],
  ['dates', /תאריכ|מועד|dates?/i],
  ['pickupLocation', /מקום האיסוף|מיקום האיסוף|סניף איסוף|איסוף|pickup (?:location|branch)/i],
  ['dropoffLocation', /מקום ההחזרה|מיקום ההחזרה|סניף החזרה|החזרה|return (?:location|branch)|dropoff/i],
  ['vehiclePreference', /סוג הרכב|קטגוריה|דגם|vehicle|car type|category/i],
  ['passengers', /נוסעים|אנשים|passengers|people/i],
  ['luggage', /מזווד|מטען|luggage|bags/i],
  ['budget', /תקציב|budget/i],
  ['annualKm', /קילומטר|קילומטרא|ק[״"]?מ|mileage|annual km/i],
  ['equipment', /אבזור|העדפות|גג פתוח|גג נפתח|קארפליי|קאר פליי|מושבי עור|equipment|preferences/i],
];

/** Intent must be an instruction, not a mention, hypothetical or negation. */
export function parseConversationControl(text: string, pending?: 'forget' | 'edit'): ControlAction | null {
  if (/(?:אל|לא)\s+(?:תמחק|מחק|תשכח|תאפס|תתחיל|למחוק|להתחיל|לשנות)|don['’]?t\s+(?:delete|forget|reset|restart|change)|do not\s+(?:delete|forget|reset|restart|change)/i.test(text)) return null;
  if (/מה (?:יקרה|קורה) אם|מה זה|איך (?:מוחקים|משנים)|what (?:happens|if)|how (?:do|can) (?:i|you)/i.test(text)) return null;
  const reset = /(?:תתחיל|נתחיל|להתחיל|תתחילו|התחל)(?: את (?:השיחה|הכל|הכול))? (?:מחדש|מההתחלה)|(?:אפס|תאפס|לאפס) (?:את )?(?:השיחה|הצ[׳']?אט|הכל|הכול)|(?:תמחק|מחק|תשכח|שכח) (?:את )?(?:הכל|הכול|כל (?:השיחה|הפרטים))|start (?:all )?over|start (?:again|from (?:the )?beginning)|reset (?:the )?(?:chat|conversation)|forget everything|delete everything/i.test(text);
  if (reset) return { kind: 'reset' };
  const forgetting = /(?:^|\s)(?:תמחק|מחק|תשכח|שכח|תסיר|הסר|delete|remove|forget)(?=\s|$)/i.test(text);
  const editing = /(?:^|\s)(?:תשנה|שנה|תעדכן|עדכן|לשנות|לעדכן|change|update|correct)(?=\s|$)/i.test(text);
  const kind = forgetting ? 'forget' : editing ? 'edit' : pending;
  if (!kind) return null;
  if (/הזמנה|חיוב|חשבונית|booking|reservation|invoice|charge|extend|extension/i.test(text)) return kind === 'forget' ? { kind: 'external' } : null;
  let fields = FIELDS.filter(([, pattern]) => pattern.test(text)).map(([field]) => field);
  // Pickup/return alone are ambiguous: a calendar expression or explicit date
  // label is not a location. Keep the untouched endpoint when editing one date.
  const calendar = /\d{1,2}[/.\-]\d{1,2}|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר|מחר|תאריך|מועד|\b(?:date|january|february|march|april|may|june|july|august|september|october|november|december|tomorrow)\b/i.test(text);
  if (calendar && !/מקום|מיקום|סניף|location|branch/i.test(text)) {
    const pickup = /איסוף|pickup|pick.up/i.test(text);
    const dropoff = /החזרה|להחזיר|return|dropoff/i.test(text);
    if (pickup || dropoff) {
      fields = fields.filter(field => !['dates', 'pickupLocation', 'dropoffLocation'].includes(field));
      fields.unshift(...(pickup ? ['pickupDate' as const] : []), ...(dropoff ? ['dropoffDate' as const] : []));
    }
  }
  if (pending && !forgetting && !editing && !fields.length) return null;
  return { kind, fields };
}

export function forgetConversationFacts(state: FlowState, fields: EditableFact[]): FlowState {
  const next = structuredClone(state);
  const removed: string[] = [];
  for (const field of fields) {
    if (field === 'budget' || field === 'annualKm' || field === 'equipment') {
      const consultation = next.localConsultation;
      if (consultation) {
        if (field === 'equipment') { removed.push(...consultation.equipment); consultation.equipment = []; }
        if (field === 'budget') { if (consultation.budget) removed.push(String(consultation.budget)); delete consultation.budget; delete consultation.budgetDeclined; }
        if (field === 'annualKm') { if (consultation.annualKm) removed.push(String(consultation.annualKm)); delete consultation.annualKm; }
      }
    } else {
      const keys = field === 'dates' ? ['pickupDate', 'dropoffDate', 'pickupTime', 'returnTime'] as const : [field] as const;
      for (const key of keys) { if (next[key] !== undefined) removed.push(String(next[key])); delete next[key]; }
    }
  }
  // Old summaries and returning-customer snapshots must not silently restore
  // erased facts. This forgets chat memory, not business booking records.
  delete next.conversationMemory;
  delete next.returning;
  next.returningChecked = true;
  next.history = (next.history ?? []).map(entry => ({ ...entry, text: removed.filter(Boolean).reduce((text, value) => text.split(value).join('[הוסר מהשיחה]'), entry.text) }));
  delete next.pendingEdit;
  delete next.pendingControl;
  return next;
}

export function factQuestion(field: EditableFact, locale: 'he' | 'en') {
  const questions: Record<EditableFact, [string, string]> = {
    customerEmail: ['מה כתובת המייל החדשה?', 'What is the new email address?'],
    customerName: ['מה השם המעודכן?', 'What is the updated name?'],
    dates: ['מה תאריכי האיסוף וההחזרה המעודכנים?', 'What are the updated pickup and return dates?'],
    pickupDate: ['מה תאריך האיסוף המעודכן?', 'What is the updated pickup date?'],
    dropoffDate: ['מה תאריך ההחזרה המעודכן?', 'What is the updated return date?'],
    pickupLocation: ['מאיפה תרצה לאסוף במקום?', 'Where would you like to pick up instead?'],
    dropoffLocation: ['איפה תרצה להחזיר במקום?', 'Where would you like to return instead?'],
    vehiclePreference: ['איזה סוג רכב תרצה במקום?', 'Which vehicle type would you prefer instead?'],
    passengers: ['כמה נוסעים תהיו?', 'How many passengers will there be?'],
    luggage: ['כמה מזוודות תביאו?', 'How many suitcases will you bring?'],
    budget: ['מה התקציב החודשי המעודכן?', 'What is the updated monthly budget?'],
    annualKm: ['כמה ק״מ בשנה לרשום במקום?', 'What annual mileage should I record instead?'],
    equipment: ['מה העדפות האבזור המעודכנות?', 'What are your updated equipment preferences?'],
  };
  return questions[field][locale === 'he' ? 0 : 1];
}
