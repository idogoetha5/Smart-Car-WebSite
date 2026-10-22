/**
 * The bot's "brain without a brain": large phrase lists (scripts/whatsapp-eval/
 * lexicon/brain/*.json, compiled into whatsapp-brain-data.ts) and a fast
 * matcher, so everyday messages, places, cars, group sizes and dates are
 * understood even when Gemini is unavailable.
 */
import { BRAIN } from '@/lib/whatsapp-brain-data';
import { BRAIN_LR_TEXT, BRAIN_NB_TEXT } from '@/lib/whatsapp-brain-model';
import { brainFeatures, brainNormalize, stripPrefix } from '@/lib/whatsapp-brain-features';
import type { Situation } from '@/lib/whatsapp-replies';

export { brainNormalize } from '@/lib/whatsapp-brain-features';

// A prefix is only peeled off a word that stays three letters long ("הלל" is a name, not "ה" + "לל").
const PREFIX = /^(?:וכש|וש|כש|וה|וב|ול|ומ|ה|ב|ל|מ|ו|ש)(?=[א-ת]{3,})/;

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

// ---------------------------------------------------------------------------
// The trained classifier (scripts/whatsapp-eval/build-brain-model.mjs): reads
// phrasings that are in no list, by their words and letter pieces.

type Model = { labels: string[]; defaults: number[]; features: Map<string, Array<[number, number]>>; logistic: boolean };
let models: { nb: Model; lr: Model } | null = null;

function parseModel(text: string, logistic: boolean): Model {
  const lines = text.split('\n');
  const features = new Map<string, Array<[number, number]>>();
  for (let i = 2; i < lines.length; i += 1) {
    const tab = lines[i].indexOf('\t');
    if (tab < 1 || tab === lines[i].length - 1) continue;
    features.set(lines[i].slice(0, tab), lines[i].slice(tab + 1).split(',').map((pair) => {
      const [label, weight] = pair.split(':');
      return [Number(label), Number(weight)] as [number, number];
    }));
  }
  return { labels: lines[0].split('|'), defaults: lines[1].split(',').map(Number), features, logistic };
}

function run(model: Model, features: string[]) {
  const scores = model.defaults.map(() => 0);
  let seen = 0;
  for (const feature of features) {
    const weights = model.features.get(feature);
    if (!weights) continue;
    seen += 1;
    for (const [label, weight] of weights) scores[label] += weight;
  }
  if (model.logistic) {
    const scale = 1 / Math.sqrt(Math.max(seen, 1));
    for (let c = 0; c < scores.length; c += 1) scores[c] = scores[c] * scale + model.defaults[c];
  } else for (let c = 0; c < scores.length; c += 1) scores[c] += model.defaults[c] * seen;
  let best = 0;
  for (let c = 1; c < scores.length; c += 1) if (scores[c] > scores[best]) best = c;
  const total = scores.reduce((sum, score) => sum + Math.exp(score - scores[best]), 0);
  return { label: model.labels[best], confidence: 1 / total, seen };
}

export type BrainReading = { label: string; confidence: number; sure: boolean; agree: boolean; nb: number; known: number };

/**
 * What the message is, by the trained models: an everyday situation
 * ("greeting", "thanks"…), "faq:<topic>", "rental", "urgent:<kind>" or
 * "detail" (a bare place, date or car). `sure` only when both models agree.
 */
export function brainClassify(text: string): BrainReading | null {
  const features = brainFeatures(text);
  if (!features.length) return null;
  models ??= { nb: parseModel(BRAIN_NB_TEXT, false), lr: parseModel(BRAIN_LR_TEXT, true) };
  // How much of the message the model has met: "helicopter registration" is mostly unknown.
  // Content words only ("what", "is", "מה", "יש" say little about whether the model knows the topic).
  const all = brainNormalize(text).split(' ').filter((word) => word.length > 1);
  const content = all.filter((word) => word.length >= 4);
  const words = content.length ? content : all;
  const known = words.length ? words.filter((word) => models!.nb.features.has(`w:${word}`) || models!.nb.features.has(`w:${stripPrefix(word)}`)).length / words.length : 0;
  const nb = run(models.nb, features);
  const lr = run(models.lr, features);
  if (!nb.seen) return null;
  const sure = nb.label === lr.label && nb.confidence >= 0.5 && lr.confidence >= 0.2;
  return { label: nb.label, confidence: Math.min(nb.confidence, lr.confidence), sure, agree: nb.label === lr.label, nb: nb.confidence, known };
}

/** The everyday situation by the trained models, for wording that is in no list. */
export function brainLearnedSituation(text: string): Situation | null {
  const normal = brainNormalize(text);
  // Words only: "1" is a menu choice, "15/11" a date.
  if (!normal || normal.split(' ').length > 10 || !/[א-תa-z]{2,}/.test(normal)) return null;
  const reading = brainClassify(normal);
  return reading?.sure && !reading.label.includes(':') && reading.label !== 'detail' && reading.label !== 'rental' ? reading.label as Situation : null;
}

/** The business question a message asks, by the trained models ("faq:fuel" → "fuel"). */
export function brainQuestionTopic(text: string): string | null {
  const normal = brainNormalize(text);
  if (normal.split(' ').length > 25 || !/[א-תa-z]{2,}/.test(normal)) return null;
  const reading = brainClassify(normal);
  if (!reading?.label.startsWith('faq:')) return null;
  // A question ("?" or a question word) needs only both models to agree; anything else must be sure.
  const asks = /\?/.test(text) || /(?:^|\s)(?:מה|איך|כמה|האם|איפה|מתי|למה|מי|יש|אפשר|מותר|צריך|באיזה|איזה|what|how|where|when|why|who|is|are|can|do|does)(?=\s|$)/i.test(normal);
  // One or two words without a question ("מיכל" is a name as much as a fuel tank) never decide a topic alone.
  if (!asks && normal.split(' ').length < 3) return null;
  return reading.known >= 0.6 && (reading.sure || (asks && (reading.agree || reading.nb >= 0.9))) ? reading.label.slice(4) : null;
}

/** True when the trained models agree the message asks for a car. */
export function brainWantsRental(text: string) {
  const reading = brainClassify(text);
  return Boolean(reading?.sure && reading.label === 'rental' && reading.confidence >= 0.5);
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
  // "אני ועוד 2", "me plus 3"
  const alone = normal.match(/^(?:אני\s+)?ו?עוד\s+(\d{1,2})$|^me (?:and|plus) (\d{1,2})$/);
  if (alone) return Math.min(Number(alone[1] ?? alone[2]) + 1, 20);
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
