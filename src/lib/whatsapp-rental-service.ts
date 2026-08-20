import type { FlowState } from '@/lib/whatsapp-flow';

type Locale = 'he' | 'en';
const label = (state: FlowState, locale: Locale) => locale === 'he'
  ? [state.pickupDate && `איסוף ב־${state.pickupDate}`, state.dropoffDate && `החזרה ב־${state.dropoffDate}`, state.pickupLocation && `איסוף מ־${state.pickupLocation}`, state.dropoffLocation && `החזרה ב־${state.dropoffLocation}`].filter(Boolean).join(', ')
  : [state.pickupDate && `pickup ${state.pickupDate}`, state.dropoffDate && `return ${state.dropoffDate}`, state.pickupLocation && `from ${state.pickupLocation}`, state.dropoffLocation && `to ${state.dropoffLocation}`].filter(Boolean).join(', ');

export function rentalServicePrompt(state: FlowState, locale: Locale, question: string) {
  const summary = label(state, locale);
  if (locale === 'en') return `${summary ? `I’ve noted ${summary}. ` : 'Happy to help find the right car. '}${question}`;
  return `${summary ? `רשמתי: ${summary}. ` : 'בשמחה, נמצא את הרכב שמתאים לך. '}${question}`;
}

export function rentalConfirmationIntro(state: FlowState, locale: Locale) {
  const summary = label(state, locale);
  return locale === 'en' ? `I’ve noted ${summary}. Please review the request below.` : `רשמתי: ${summary}. אפשר לבדוק את פרטי הבקשה:`;
}
