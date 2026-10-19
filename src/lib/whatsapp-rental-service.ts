import type { FlowState } from '@/lib/whatsapp-flow';

type Locale = 'he' | 'en';
const day = (iso?: string) => iso ? iso.split('-').reverse().join('/') : iso;
type Field = 'pickupDate' | 'dropoffDate' | 'pickupLocation' | 'dropoffLocation';
const label = (full: FlowState, locale: Locale, previous?: FlowState | null) => {
  // With a previous state, repeat only what this message added, so the
  // customer is not read the whole request back after every reply.
  const state: Partial<FlowState> = previous
    ? Object.fromEntries((['pickupDate', 'dropoffDate', 'pickupLocation', 'dropoffLocation'] as Field[])
      .filter((field) => full[field] && full[field] !== previous[field]).map((field) => [field, full[field]]))
    : full;
  return locale === 'he'
  ? [state.pickupDate && `איסוף ב־${day(state.pickupDate)}`, state.dropoffDate && `החזרה ב־${day(state.dropoffDate)}`, state.pickupLocation && `איסוף מ־${state.pickupLocation}`, state.dropoffLocation && `החזרה ב־${state.dropoffLocation}`].filter(Boolean).join(', ')
  : [state.pickupDate && `pickup ${day(state.pickupDate)}`, state.dropoffDate && `return ${day(state.dropoffDate)}`, state.pickupLocation && `from ${state.pickupLocation}`, state.dropoffLocation && `to ${state.dropoffLocation}`].filter(Boolean).join(', ');
};

export function rentalServicePrompt(state: FlowState, locale: Locale, question: string, previous?: FlowState | null) {
  // The dates question already names the pickup date it is asking after.
  const summary = state.step === 'rental_dates' ? '' : label(state, locale, previous);
  if (locale === 'en') return `${summary ? `I’ve noted ${summary}. ` : ''}${question}`;
  return `${summary ? `רשמתי: ${summary}. ` : ''}${question}`;
}

export function rentalConfirmationIntro(state: FlowState, locale: Locale) {
  const summary = label(state, locale);
  return locale === 'en' ? `I’ve noted ${summary}. Please review the request below.` : `רשמתי: ${summary}. אפשר לבדוק את פרטי הבקשה:`;
}
