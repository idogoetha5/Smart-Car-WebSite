import type { FlowState } from '@/lib/whatsapp-flow';

type Locale = 'he' | 'en';
const day = (iso?: string) => iso ? iso.split('-').reverse().join('/') : iso;
type Field = 'pickupDate' | 'dropoffDate' | 'pickupLocation' | 'dropoffLocation';
const ENGLISH_PLACES: Record<string, string> = {
  'נתב״ג': 'Ben Gurion Airport', 'הרצליה': 'Herzliya', 'תל אביב': 'Tel Aviv', 'ירושלים': 'Jerusalem', 'חיפה': 'Haifa', 'אילת': 'Eilat', 'נתניה': 'Netanya',
  'רעננה': 'Raanana', 'פתח תקווה': 'Petah Tikva', 'ראשון לציון': 'Rishon LeZion', 'חולון': 'Holon', 'בת ים': 'Bat Yam', 'רמת גן': 'Ramat Gan', 'גבעתיים': 'Givatayim',
  'כפר סבא': 'Kfar Saba', 'הוד השרון': 'Hod HaSharon', 'אשדוד': 'Ashdod', 'אשקלון': 'Ashkelon', 'מודיעין': 'Modiin', 'באר שבע': 'Beersheba', 'רחובות': 'Rehovot',
  'נס ציונה': 'Ness Ziona', 'רמת השרון': 'Ramat HaSharon', 'חדרה': 'Hadera', 'זכרון יעקב': 'Zichron Yaakov', 'קיסריה': 'Caesarea', 'טבריה': 'Tiberias', 'נצרת': 'Nazareth', 'עכו': 'Acre', 'נהריה': 'Nahariya', 'כרמיאל': 'Karmiel',
};
/** A place as the customer reads it: "Ben Gurion Airport" in English, "נתב״ג" in Hebrew. */
export const placeName = (place: string | undefined, locale: Locale) => (place && locale === 'en' ? ENGLISH_PLACES[place] ?? place : place);

const label = (full: FlowState, locale: Locale, previous?: FlowState | null) => {
  // With a previous state, repeat only what this message added, so the
  // customer is not read the whole request back after every reply.
  const state: Partial<FlowState> = previous
    ? Object.fromEntries((['pickupDate', 'dropoffDate', 'pickupLocation', 'dropoffLocation'] as Field[])
      .filter((field) => full[field] && full[field] !== previous[field]).map((field) => [field, full[field]]))
    : full;
  return locale === 'he'
  ? [state.pickupDate && `איסוף ב־${day(state.pickupDate)}`, state.dropoffDate && `החזרה ב־${day(state.dropoffDate)}`, state.pickupLocation && `איסוף מ־${state.pickupLocation}`, state.dropoffLocation && `החזרה ב־${state.dropoffLocation}`].filter(Boolean).join(', ')
  : [state.pickupDate && `pickup ${day(state.pickupDate)}`, state.dropoffDate && `return ${day(state.dropoffDate)}`, state.pickupLocation && `from ${placeName(state.pickupLocation, locale)}`, state.dropoffLocation && `to ${placeName(state.dropoffLocation, locale)}`].filter(Boolean).join(', ');
};

export function rentalServicePrompt(state: FlowState, locale: Locale, question: string, previous?: FlowState | null) {
  // Confirm what this message added only when it added several details at
  // once; a single detail is already named in the question itself.
  const added = previous ? (['pickupDate', 'dropoffDate', 'pickupLocation', 'dropoffLocation'] as Field[]).filter((field) => state[field] && state[field] !== previous[field]).length : 0;
  const summary = state.step === 'rental_dates' || added < 2 ? '' : label(state, locale, previous);
  if (locale === 'en') return `${summary ? `Got it — ${summary} ✅\n\n` : ''}${question}`;
  return `${summary ? `סגור — ${summary} ✅\n\n` : ''}${question}`;
}

export function rentalConfirmationIntro(state: FlowState, locale: Locale) {
  const summary = label(state, locale);
  return locale === 'en' ? `I’ve noted ${summary}. Please review the request below.` : `רשמתי: ${summary}. אפשר לבדוק את פרטי הבקשה:`;
}
