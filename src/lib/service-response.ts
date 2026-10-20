import type { FlowState } from '@/lib/whatsapp-flow';

export type ConversationMood = 'normal' | 'pressed' | 'frustrated' | 'angry' | 'urgent' | 'uncertain';
export type ServiceResponseKind = 'information' | 'request' | 'change' | 'complaint' | 'handoff' | 'emergency';
type Locale = 'he' | 'en';

export function detectConversationMood(input: string): ConversationMood {
  const text = input.toLowerCase();
  if (/תאונה|סכנה|פצוע|הצילו|דחוף|urgent|emergency|accident|injured|danger/.test(text)) return 'urgent';
  if (/הזוי|כועס|זועם|מתוסכל|לא הגיוני|למה אתם|כבר כתבתי|שוב שואלים|ridiculous|unacceptable|angry|furious|frustrated|why are you|already told/.test(text)) return 'angry';
  if (/מאחר|איחור|טיסה.*מתעכב|לחוץ|late|delayed|delay|flight/.test(text)) return 'pressed';
  if (/לא בטוח|מה מתאים|תמליץ|לא יודע|not sure|which.*best|recommend/.test(text)) return 'uncertain';
  return 'normal';
}

function contextSummary(state: FlowState | null | undefined, locale: Locale) {
  if (!state) return '';
  const facts = [
    state.pickupDate && (locale === 'he' ? `איסוף ${state.pickupDate}` : `pickup ${state.pickupDate}`),
    state.dropoffDate && (locale === 'he' ? `החזרה ${state.dropoffDate}` : `return ${state.dropoffDate}`),
    state.pickupLocation && (locale === 'he' ? `מ־${state.pickupLocation}` : `from ${state.pickupLocation}`),
    state.dropoffLocation && (locale === 'he' ? `ל־${state.dropoffLocation}` : `to ${state.dropoffLocation}`),
  ].filter(Boolean);
  if (!facts.length) return '';
  return locale === 'he' ? `רשמתי כבר: ${facts.join(', ')}.` : `I already have: ${facts.join(', ')}.`;
}

function acknowledgement(mood: ConversationMood, kind: ServiceResponseKind, locale: Locale, subject?: string, seed = '') {
  if (locale === 'en') {
    if (mood === 'angry') return `I understand why ${subject ?? 'this'} feels frustrating.`;
    if (mood === 'pressed') return `I understand timing matters here${subject ? `, especially with ${subject}` : ''}.`;
    if (mood === 'uncertain') return 'I can help narrow this down.';
    if (kind === 'emergency') return 'I’m sorry this happened.';
    return kind === 'information' ? vary(['', 'Sure —', 'Good question.', 'Happy to help.', ''], seed) : 'I understand.';
  }
  if (mood === 'angry') return `אני מבין למה ${subject ?? 'זה'} מתסכל במיוחד.`;
  if (mood === 'pressed') return `אני מבין שהזמן חשוב כאן${subject ? `, במיוחד עם ${subject}` : ''}.`;
  if (mood === 'uncertain') return 'בשמחה, נעזור לצמצם את האפשרויות.';
  if (kind === 'emergency') return 'מצטערים שזה קרה.';
  return kind === 'information' ? vary(['', 'בטח 🙂', 'שאלה טובה.', 'אז ככה —', ''], seed) : 'הבנתי.';
}

/** The same opener on every answer reads like a machine: pick one by the question itself. */
function vary(options: string[], seed = '') {
  let h = 0;
  for (const ch of `${seed}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

/** A concise WhatsApp response: acknowledgement, useful answer, one next action. */
export function composeServiceResponse(params: {
  locale: Locale;
  input: string;
  kind: ServiceResponseKind;
  state?: FlowState | null;
  answer?: string;
  nextStep?: string;
  subject?: string;
}) {
  const mood = detectConversationMood(params.input);
  // Many published answers already open warmly ("שאלה חשובה.", "בשמחה."); never stack two openers.
  const answerOpens = /^(?:שאלה (?:חשובה|טובה)|בשמחה|כן|בטח|הבנתי|important question|good question|of course|happy to|yes|sure)\b|^(?:שאלה (?:חשובה|טובה)|בשמחה|כן|בטח|הבנתי)[.,!—\s]/i.test(params.answer ?? '');
  const intro = answerOpens && mood !== 'angry' && mood !== 'pressed' ? '' : acknowledgement(mood, params.kind, params.locale, params.subject, params.input);
  const context = (mood === 'angry' || mood === 'pressed') ? contextSummary(params.state, params.locale) : '';
  return [intro, context, params.answer, params.nextStep].filter(Boolean).join(' ');
}

