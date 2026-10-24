import type { FlowState } from '@/lib/whatsapp-flow';
import { withoutNegated } from '@/lib/whatsapp-context';

export type EditableFact = 'customerEmail' | 'customerName' | 'dates' | 'pickupDate' | 'dropoffDate' | 'pickupLocation' | 'dropoffLocation' | 'vehiclePreference' | 'passengers' | 'luggage' | 'budget' | 'annualKm' | 'equipment';
export type ControlAction = { kind: 'reset' } | { kind: 'external' } | { kind: 'forget' | 'edit'; fields: EditableFact[] };

/** A correction to our explanation must reach the adviser, even during an edit. */
export function isAdviceCorrection(text: string): boolean {
  if (/(?:change|update|correct)\s+(?:(?:my|the)\s+)?(?:email|name|pickup date|return date|vehicle type)|(?:תשנה|תעדכן)\s+(?:את\s+)?(?:המייל|השם|תאריך|סוג הרכב)/i.test(text)) return false;
  return /(?:\b(?:correct|fix|revise)\s+(?:(?:that|the|your)\s+(?:assumption|answer|claim|statement)|what you (?:said|told)|that\s*:)|(?:תתקן|תקן|תתקני|תקני)\s+(?:רק\s+)?(?:את\s+)?(?:ההנחה|התשובה|הטענה|מה שאמרת))/i.test(text);
}

const FIELDS: Array<[EditableFact, RegExp]> = [
  ['customerEmail', /מייל|דוא[״"]?ל|email|e-mail/i],
  ['customerName', /(?:^|\s)(?:השם|שם|name)(?=\s|$|[,.!?])/i],
  ['dates', /תאריכ|מועד|dates?/i],
  ['pickupLocation', /מקום האיסוף|מיקום האיסוף|סניף איסוף|איסוף|pickup (?:location|branch)/i],
  ['dropoffLocation', /מקום ההחזרה|מיקום ההחזרה|סניף החזרה|החזרה|return (?:location|branch)|dropoff/i],
  ['vehiclePreference', /סוג הרכב|קטגוריה|דגם|vehicle|car type|category/i],
  ['passengers', /נוסעים|אנשים|passengers|people/i],
  ['luggage', /מזווד|מטען|כלי נגינה|luggage|bags|suitcases?|cargo|musical instruments?/i],
  ['budget', /תקציב|budget/i],
  ['annualKm', /קילומטר|קילומטרא|ק[״"]?מ|mileage|kilomet|\bkm\b|yearly distance/i],
  ['equipment', /אבזור|העדפות|גג פתוח|גג נפתח|קארפליי|קאר פליי|מושבי עור|equipment|preferences/i],
];

/** A scoped forget instruction must also govern future retrieval of old quotes. */
export function redactForgottenHistoryText(text: string, position: number, boundaries?: Partial<Record<EditableFact, number>>): string {
  const patterns = Object.entries(boundaries ?? {}).flatMap(([field, boundary]) => {
    if (typeof boundary !== 'number' || position > boundary) return [];
    const pattern = FIELDS.find(([key]) => key === field)?.[1]
      ?? (field === 'pickupDate' || field === 'dropoffDate' ? /תאריך|מועד|איסוף|החזרה|date|pickup|return|dropoff/i : null);
    return pattern ? [pattern] : [];
  });
  if (!patterns.length && !text.includes('[הוסר מהשיחה]')) return text;
  // Keep conjunction/negation in the surviving clause ("and cannot charge").
  // Do not split thousands separators or decimal numbers.
  return text.split(/[;.!?](?:\s+|$)|,(?!\d)\s*|\s+(?=and\b|but\b|אבל\b|ואין\b|ולא\b|וגם\b)/i)
    .filter(clause => !clause.includes('[הוסר מהשיחה]') && !patterns.some(pattern => pattern.test(clause)))
    .map(clause => clause.trim()).filter(Boolean).join('. ');
}

/** Intent must be an instruction, not a mention, hypothetical or negation. */
export function parseConversationControl(text: string, pending?: 'forget' | 'edit'): ControlAction | null {
  if (/(?:אל|לא)\s+(?:תמחק|מחק|תשכח|תאפס|תתחיל|למחוק|להתחיל|לשנות)|don['’]?t\s+(?:delete|forget|reset|restart|change)|do not\s+(?:delete|forget|reset|restart|change)/i.test(text)) return null;
  if (/מה (?:יקרה|קורה) אם|מה זה|איך (?:מוחקים|משנים)|what (?:happens|if)|how (?:do|can) (?:i|you)/i.test(text)) return null;
  // "בלי להתחיל מחדש" must not execute the reset phrase it prohibits.
  text = withoutNegated(text);
  // Correcting the adviser's answer is not editing a customer's stored fact.
  // A field mentioned later in the explanation (e.g. choosing a vehicle) is
  // not the object of "correct that assumption".
  if (isAdviceCorrection(text)) return null;
  const reset = /(?:תתחיל|נתחיל|להתחיל|תתחילו|התחל)(?: את (?:השיחה|הכל|הכול))? (?:מחדש|מההתחלה)|(?:אפס|תאפס|לאפס) (?:את )?(?:השיחה|הצ[׳']?אט|הכל|הכול)|(?:תמחק|מחק|תשכח|שכח) (?:את )?(?:הכל|הכול|כל (?:השיחה|הפרטים))(?: עכשיו| בבקשה)?(?=\s*(?:[.!?]|$))|start (?:all )?over|start (?:again|from (?:the )?beginning)|reset (?:the )?(?:chat|conversation)|(?:forget|delete) everything(?: we (?:said|discussed)| in (?:this|the) (?:chat|conversation))?(?: now| please)?(?=\s*(?:[.!?]|$))/i.test(text);
  if (reset) return { kind: 'reset' };
  // Pausing a topic is not a request to erase records or reset the chat.
  if (/\bforget (?:the )?[^.!?]{0,60}\b(?:discussion|topic)\b[^.!?]{0,30}\bfor now\b/i.test(text)) return null;
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
  next.memoryForgetBefore = { ...next.memoryForgetBefore, ...Object.fromEntries(fields.map(field => [field, next.history?.length ?? 0])) };
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
  // Free-form summaries have no per-fact provenance. Clear them rather than
  // risk reintroducing a requested deletion; unrelated archive clauses remain.
  delete next.conversationMemory;
  delete next.returning;
  next.returningChecked = true;
  next.history = (next.history ?? []).map(entry => ({ ...entry, text: removed.filter(Boolean).reduce((text, value) => text.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[הוסר מהשיחה]'), entry.text) }));
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
