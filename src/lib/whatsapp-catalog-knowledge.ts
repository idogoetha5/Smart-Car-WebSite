import { getVehicles } from '@/lib/db/vehicles';

type Rows = Awaited<ReturnType<typeof getVehicles>>;
let cached: { at: number; rows: Rows } | null = null;
let loading: Promise<Rows> | null = null;

const CAR_WORDS = /רכב|רכבים|אוטו|דגם|דגמים|מקומות|מושבים|אוטומט|ידני|גיר|חשמלי|היברידי|בנזין|סולר|ג׳יפ|גיפ|ג'יפ|ג׳יפון|משפחתי|מיניוואן|ואן|יוקרה|צי|kia|toyota|bmw|mercedes|hyundai|mazda|skoda|ford|suzuki|mitsubishi|nissan|tesla|byd|\bcars?\b|vehicle|model|seats?|automatic|manual|electric|hybrid|diesel|suv|jeep|van|minivan|luxury|fleet/i;

const CATEGORY_NAMES: Record<string, { he: string; en: string }> = {
  ECONOMY: { he: 'קטן וחסכוני', en: 'Small and economical' },
  ECONOMY_COMPACT: { he: 'קטן וחסכוני', en: 'Small and economical' },
  COMPACT: { he: 'קומפקטי', en: 'Compact' },
  SEDAN: { he: 'משפחתי', en: 'Family' },
  SUV: { he: 'ג׳יפון / SUV', en: 'Crossover / SUV' },
  VAN: { he: '7 מקומות ומעלה', en: '7 seats or more' },
  LUXURY: { he: 'יוקרה', en: 'Luxury' },
  ELECTRIC: { he: 'חשמלי', en: 'Electric' },
};

async function loadFleet(): Promise<Rows | null> {
  if (cached && Date.now() - cached.at <= 60_000) return cached.rows;
  loading ??= getVehicles({ isAvailable: true }).then((rows) => {
    cached = { at: Date.now(), rows };
    return rows;
  }).finally(() => { loading = null; });
  // A database issue must not hold the conversation hostage.
  return Promise.race([loading, new Promise<null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 1800);
    timer.unref?.();
  })]).catch(() => null);
}

/**
 * Public specs of the rental fleet, grouped by category, for the model to
 * recommend real models. No plates, customer data or prices: rental prices
 * come only from the date/season engine.
 *
 * `always` includes the fleet even when the message does not mention cars
 * (for example while the customer is choosing a car).
 */
export async function getWhatsAppCatalogueFacts(message: string, locale: 'he' | 'en', options: { always?: boolean } = {}): Promise<string> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return '';
  if (!options.always && !CAR_WORDS.test(message)) return '';
  try {
    const rows = await loadFleet();
    if (!rows?.length) return '';
    const groups = new Map<string, Map<string, { seats: Set<number>; transmission: Set<string>; fuel: Set<string>; id: string; year: number }>>();
    for (const v of rows) {
      const category = v.category || 'OTHER';
      const name = `${v.make} ${v.model}`.trim();
      const models = groups.get(category) ?? new Map();
      const entry = models.get(name) ?? { seats: new Set<number>(), transmission: new Set<string>(), fuel: new Set<string>(), id: v.id, year: v.year };
      if (v.seats) entry.seats.add(v.seats);
      if (v.transmission) entry.transmission.add(String(v.transmission).toLowerCase());
      if (v.fuelType) entry.fuel.add(String(v.fuelType).toLowerCase());
      entry.year = Math.max(entry.year ?? 0, v.year ?? 0);
      models.set(name, entry);
      groups.set(category, models);
    }
    const lines = [...groups].map(([category, models]) => {
      const title = CATEGORY_NAMES[category]?.[locale] ?? category;
      const list = [...models].slice(0, 10).map(([name, m]) => `${name} (${[...m.seats].join('/')} ${locale === 'he' ? 'מקומות' : 'seats'}, ${[...m.transmission].join('/')}, ${[...m.fuel].join('/')})`).join('; ');
      return `- ${title} [${category}]: ${list}`;
    });
    const header = locale === 'he'
      ? 'צי ההשכרה של SmartCar (דגמים לדוגמה בכל קטגוריה; לא אישור זמינות לתאריכים ולא מחיר):'
      : 'SmartCar rental fleet (example models per category; not date-specific availability or pricing):';
    return `${header}\n${lines.join('\n')}\n${locale === 'he' ? 'עמוד הרכבים' : 'Fleet page'}: https://www.smartcar.co.il/${locale}/rental`;
  } catch {
    return '';
  }
}
