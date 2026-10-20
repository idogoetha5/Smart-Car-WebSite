/**
 * The bot's "brain without a brain": large phrase lists (scripts/whatsapp-eval/
 * lexicon/brain/*.json, compiled into whatsapp-brain-data.ts) and a fast
 * matcher, so everyday messages, places, cars, group sizes and dates are
 * understood even when Gemini is unavailable.
 */
import { BRAIN } from '@/lib/whatsapp-brain-data';
import type { Situation } from '@/lib/whatsapp-replies';

/** Lowercase, no niqqud or punctuation, final letters folded, "חחחחח" → "חחח", "תודהההה" → "תודה". */
export function brainNormalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[״"׳'`´]/g, '')
    .replace(/[ךםןףץ]/g, (ch) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' } as Record<string, string>)[ch] ?? ch)
    .replace(/([א-תa-z])\1{2,}/g, '$1$1')
    .replace(/[^א-תa-z0-9\s\p{Extended_Pictographic}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIX = /^(?:וכש|וש|כש|וה|וב|ול|ומ|ה|ב|ל|מ|ו|ש)(?=[א-ת]{2,})/;

type Index = Map<string, string>;
function buildIndex(entries: Array<[string, string[]]>): { exact: Index; maxWords: number } {
  const exact: Index = new Map();
  let maxWords = 1;
  for (const [value, phrases] of entries) {
    for (const phrase of phrases) {
      const key = brainNormalize(phrase);
      if (!key) continue;
      if (!exact.has(key)) exact.set(key, value);
      maxWords = Math.max(maxWords, key.split(' ').length);
    }
  }
  return { exact, maxWords: Math.min(maxWords, 6) };
}

/** Every phrase of the index that appears in the text, longest first, with its position. */
function scan(text: string, index: { exact: Index; maxWords: number }) {
  const words = brainNormalize(text).split(' ').filter(Boolean);
  const hits: Array<{ value: string; at: number; length: number }> = [];
  for (let size = Math.min(index.maxWords, words.length); size >= 1; size -= 1) {
    for (let i = 0; i + size <= words.length; i += 1) {
      const gram = words.slice(i, i + size).join(' ');
      const value = index.exact.get(gram) ?? index.exact.get(gram.replace(PREFIX, ''));
      if (value && !hits.some((hit) => i < hit.at + hit.length && hit.at < i + size)) hits.push({ value, at: i, length: size });
    }
  }
  return { hits: hits.sort((a, b) => a.at - b.at), words };
}

let situations: ReturnType<typeof buildIndex> | null = null;
let places: ReturnType<typeof buildIndex> | null = null;
let vehicles: ReturnType<typeof buildIndex> | null = null;

/**
 * What kind of everyday message this is. The whole message (or nearly all of
 * it) must be the phrase, so "תודה, ואפשר גם רכב מחר?" is not just "thanks".
 */
export function brainSituation(text: string): Situation | null {
  situations ??= buildIndex(Object.entries(BRAIN.situations) as Array<[string, string[]]>);
  const normal = brainNormalize(text);
  if (!normal) return null;
  const whole = situations.exact.get(normal);
  if (whole) return whole as Situation;
  const { hits, words } = scan(normal, situations);
  if (!hits.length) return null;
  const covered = hits.reduce((sum, hit) => sum + hit.length, 0);
  // Short messages made of known phrases ("היי מה קורה", "סבבה תודה אחי"): the last phrase sets the tone.
  if (words.length <= 6 && covered >= words.length - 1) return hits[hits.length - 1].value as Situation;
  return null;
}

/** Known places in the message, in order, as their canonical Hebrew names. */
export function brainPlaces(text: string): string[] {
  places ??= buildIndex(BRAIN.places.map((place) => [place.name, [place.name, place.en, ...place.spellings]] as [string, string[]]));
  return [...new Set(scan(text, places).hits.map((hit) => hit.value))];
}

/** English name of a canonical place, when known. */
export function brainPlaceEnglish(name: string): string | undefined {
  return BRAIN.places.find((place) => place.name === name)?.en;
}

/** The car category the message asks for, from descriptions or model names. */
export function brainVehicle(text: string): string | null {
  vehicles ??= buildIndex([
    ...Object.entries(BRAIN.vehicleCategories) as Array<[string, string[]]>,
    ...BRAIN.models.map((model) => [model.category, [model.model, ...model.spellings]] as [string, string[]]),
  ]);
  const { hits } = scan(text, vehicles);
  if (!hits.length) return null;
  // The longest phrase wins: "ג׳יפ 7 מקומות" is a 7-seater, not a jeep.
  return hits.sort((a, b) => b.length - a.length)[0].value;
}

/** "אנחנו 5", "זוג", "משפחה של 6": how many travellers. */
export function brainPassengers(text: string): number | null {
  const normal = brainNormalize(text);
  // "אני ועוד 3 חברים", "me and 4 friends": the writer plus the others.
  const plus = normal.match(/(?:עוד|(?:^|\s)ו|me and|and|plus|with)\s*(\d{1,2})\s+(?:חברימ|חברות|friends|others|more people|more)(?:\s|$)|עוד\s+(\d{1,2})\s+(?:אנשימ|נוסעימ)(?:\s|$)/);
  if (plus) return Math.min(Number(plus[1] ?? plus[2]) + 1, 20);
  const total = normal.match(/(?:אנחנו|we are|were|we re|סהכ|total of)\s+(\d{1,2})(?:\s|$)|(?:^|\s)(\d{1,2})\s+(?:אנשימ|נוסעימ|מבוגרימ|people|passengers|adults|pax)(?:\s|$)/);
  if (total) { const n = Number(total[1] ?? total[2]); if (n > 0 && n <= 20) return n; }
  for (const { text: phrase, count } of BRAIN.passengers) {
    const key = brainNormalize(phrase);
    if (key && (normal === key || normal.includes(` ${key} `) || normal.startsWith(`${key} `) || normal.endsWith(` ${key}`))) return count;
  }
  return null;
}

/** True when the message says to return the car where it was picked up. */
export function brainSamePlace(text: string) {
  const normal = brainNormalize(text);
  return BRAIN.samePlace.some((phrase) => {
    const key = brainNormalize(phrase);
    return key.length > 2 && (normal === key || normal.includes(key));
  });
}

/** True when the customer asks for the car to be brought to them. */
export function brainDelivery(text: string) {
  const normal = brainNormalize(text);
  return BRAIN.deliverToMe.some((phrase) => {
    const key = brainNormalize(phrase);
    return key.length > 4 && normal.includes(key);
  });
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Dates from holidays, relative words and durations: "בחנוכה" → the Hanukkah
 * days of the coming year, "בעוד שבועיים", "לשבוע", "לסופ״ש ארוך".
 */
export function brainDates(text: string, today: string, pickupDate?: string): { pickupDate?: string; dropoffDate?: string } {
  const normal = ` ${brainNormalize(text)} `;
  const has = (phrase: string) => {
    const key = brainNormalize(phrase);
    return key.length > 1 && (normal.includes(` ${key} `) || normal.includes(` ב${key} `) || normal.includes(` ל${key} `) || normal.includes(` מ${key} `));
  };
  if (!pickupDate) {
    for (const holiday of BRAIN.holidays) {
      if (!holiday.phrases.some(has)) continue;
      const year = Object.keys(holiday.dates).sort().find((y) => (holiday.dates[y]?.[1] ?? '') >= today);
      const range = year ? holiday.dates[year] : undefined;
      if (range) return { pickupDate: range[0] >= today ? range[0] : today, dropoffDate: range[1] };
    }
    for (const relative of BRAIN.relativeDays) {
      if (relative.offset_days > 0 && relative.phrases.some(has)) return { pickupDate: addDays(today, relative.offset_days) };
    }
    return {};
  }
  for (const duration of [...BRAIN.durations].sort((a, b) => b.days - a.days)) {
    if (duration.phrases.some(has)) return { dropoffDate: addDays(pickupDate, duration.days) };
  }
  return {};
}

/** How many phrases and items the brain knows (for the report and tests). */
export function brainSize() {
  const count = (lists: Record<string, string[]>) => Object.values(lists).reduce((sum, list) => sum + list.length, 0);
  return {
    situationPhrases: count(BRAIN.situations),
    places: BRAIN.places.length,
    placeSpellings: BRAIN.places.reduce((sum, place) => sum + place.spellings.length, 0),
    vehiclePhrases: count(BRAIN.vehicleCategories),
    models: BRAIN.models.length,
    passengerPhrases: BRAIN.passengers.length,
    holidays: BRAIN.holidays.length,
    datePhrases: BRAIN.relativeDays.reduce((sum, r) => sum + r.phrases.length, 0) + BRAIN.durations.reduce((sum, d) => sum + d.phrases.length, 0),
  };
}
