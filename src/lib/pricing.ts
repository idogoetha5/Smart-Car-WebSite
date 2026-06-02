// ─── Leasing calculator constants ──────────────────────────────────────────
// These MUST stay in sync with LeasingInquirySection.tsx

export const LEASING_BASE_PRICE: Record<string, number> = {
  MINI:       2800,
  ECONOMY:    3000,
  COMPACT:    3200,
  SEDAN:      3500,
  CROSSOVER:  4500,
  SUV:        5500,
  LUXURY:     7500,
  VAN:        4500,
  COMMERCIAL: 3800,
  ELECTRIC:   3500,
};

export const LEASING_MILEAGE_MULTIPLIER: Record<string, number> = {
  '10000':   1.0,
  '15000':   1.08,
  '20000':   1.16,
  unlimited: 1.25,
};

export const LEASING_DURATION_DISCOUNT: Record<number, number> = {
  12: 1.15, 18: 1.1, 24: 1.05, 30: 1.02, 36: 1.0,
  42: 0.97, 48: 0.95, 54: 0.92, 60: 0.9,
};

/**
 * Returns the cheapest possible monthly leasing price for a vehicle category,
 * rounded UP to the nearest ₪100.
 * Cheapest config = lowest km (10,000) × longest contract (60 months).
 */
export function calcMinLeasingPrice(category: string): number {
  const base = LEASING_BASE_PRICE[category] ?? 3500;
  const minKmMultiplier = Math.min(...Object.values(LEASING_MILEAGE_MULTIPLIER));
  const maxDurationDiscount = Math.min(...Object.values(LEASING_DURATION_DISCOUNT));
  const raw = Math.round(base * minKmMultiplier * maxDurationDiscount);
  return Math.ceil(raw / 100) * 100;
}

// ─── Base price maps ───────────────────────────────────────────────────────

export type PricingCategoryKey =
  | 'MINI'
  | 'ECONOMY'
  | 'COMPACT'
  | 'SEDAN'
  | 'CROSSOVER'
  | 'SUV'
  | 'LUXURY'
  | 'VAN'
  | 'COMMERCIAL'
  | 'ELECTRIC';

export const BASE_PRICES: Record<PricingCategoryKey, number> = {
  MINI:       250,
  ECONOMY:    280,
  COMPACT:    350,
  SEDAN:      350,
  CROSSOVER:  440,
  SUV:        500,
  LUXURY:     500,
  VAN:        500,
  COMMERCIAL: 400,
  ELECTRIC:   350,
};

export const LEASING_PRICES: Record<PricingCategoryKey, number> = {
  MINI:       2800,
  ECONOMY:    3000,
  COMPACT:    3500,
  SEDAN:      3500,
  CROSSOVER:  4500,
  SUV:        7500,
  LUXURY:     7500,
  VAN:        7500,
  COMMERCIAL: 3800,
  ELECTRIC:   3500,
};

// ─── Seasonal surcharges ───────────────────────────────────────────────────

export const SEASONAL_SURCHARGES = {
  summer:  0.30, // July + August
  holiday: 0.20, // Jewish holidays
};

export const JEWISH_HOLIDAYS_2025_2026 = [
  { start: '2025-09-22', end: '2025-09-24' }, // Rosh Hashana
  { start: '2025-10-01', end: '2025-10-02' }, // Yom Kippur
  { start: '2025-10-06', end: '2025-10-13' }, // Sukkot
  { start: '2026-04-01', end: '2026-04-08' }, // Pesach
  { start: '2026-05-21', end: '2026-05-23' }, // Shavuot
];

// ─── Calculation functions ─────────────────────────────────────────────────

export function calculateDailyPrice(category: string, date: Date): number {
  const base = BASE_PRICES[category as PricingCategoryKey] ?? 350;
  const month = date.getMonth() + 1;

  if (month === 7 || month === 8) {
    return Math.round(base * (1 + SEASONAL_SURCHARGES.summer));
  }

  const dateStr = date.toISOString().split('T')[0];
  const isHoliday = JEWISH_HOLIDAYS_2025_2026.some(
    (h) => dateStr >= h.start && dateStr <= h.end
  );
  if (isHoliday) {
    return Math.round(base * (1 + SEASONAL_SURCHARGES.holiday));
  }

  return base;
}

export function calculateRentalTotal(
  category: string,
  startDate: Date,
  endDate: Date
): {
  pricePerDay: number;
  totalDays: number;
  discountPct: number;
  discount: number;
  subtotal: number;
  total: number;
  seasonal: string | null;
} {
  const totalDays = Math.max(
    1,
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const pricePerDay = calculateDailyPrice(category, startDate);
  const subtotal = pricePerDay * totalDays;

  let discountPct = 0;
  if (totalDays >= 60) discountPct = 15;
  else if (totalDays >= 30) discountPct = 10;
  else if (totalDays >= 14) discountPct = 7;

  const discount = Math.round((subtotal * discountPct) / 100);
  const total = subtotal - discount;

  const month = startDate.getMonth() + 1;
  const seasonal = month === 7 || month === 8 ? 'קיץ +30%' : null;

  return { pricePerDay, totalDays, discountPct, discount, subtotal, total, seasonal };
}

/** Simplified calculator for the pricing page slider (no date → base price only). */
export function calculateByDays(
  category: string,
  days: number
): { gross: number; discountPct: number; discountAmount: number; net: number } {
  const pricePerDay = BASE_PRICES[category as PricingCategoryKey] ?? 350;
  const gross = pricePerDay * days;

  let discountPct = 0;
  if (days >= 60) discountPct = 15;
  else if (days >= 30) discountPct = 10;
  else if (days >= 14) discountPct = 7;

  const discountAmount = Math.round((gross * discountPct) / 100);
  const net = gross - discountAmount;
  return { gross, discountPct, discountAmount, net };
}

// ─── Pricing page display data ─────────────────────────────────────────────

export const CATEGORY_PRICING: Record<
  PricingCategoryKey,
  { pricePerDay: number; pricePerMonth: number; deposit: number }
> = {
  MINI:       { pricePerDay: 250,  pricePerMonth: 2800, deposit: 800  },
  ECONOMY:    { pricePerDay: 280,  pricePerMonth: 3000, deposit: 1000 },
  COMPACT:    { pricePerDay: 350,  pricePerMonth: 3500, deposit: 1500 },
  SEDAN:      { pricePerDay: 350,  pricePerMonth: 3500, deposit: 1500 },
  CROSSOVER:  { pricePerDay: 440,  pricePerMonth: 4500, deposit: 1800 },
  SUV:        { pricePerDay: 500,  pricePerMonth: 7500, deposit: 2000 },
  LUXURY:     { pricePerDay: 500,  pricePerMonth: 7500, deposit: 3000 },
  VAN:        { pricePerDay: 500,  pricePerMonth: 4500, deposit: 2500 },
  COMMERCIAL: { pricePerDay: 400,  pricePerMonth: 3800, deposit: 2000 },
  ELECTRIC:   { pricePerDay: 350,  pricePerMonth: 3500, deposit: 2000 },
};

export interface DisplayCategory {
  key: PricingCategoryKey;
  labelHe: string;
  labelEn: string;
  examplesHe: string;
  examplesEn: string;
  seats: string;
}

export const DISPLAY_CATEGORIES: DisplayCategory[] = [
  {
    key: 'MINI',
    labelHe: 'מיני',
    labelEn: 'Mini',
    examplesHe: 'קיה פיקנטו, מיצובישי ספייסטאר, טויוטה אייגו',
    examplesEn: 'KIA Picanto, Mitsubishi Spacester, Toyota Aygo',
    seats: '4–5',
  },
  {
    key: 'ECONOMY',
    labelHe: 'כלכלה',
    labelEn: 'Economy',
    examplesHe: 'מאזדה 2, רנו קליאו, דאציה סנדרו, ניסאן מיקרה',
    examplesEn: 'Mazda 2, Renault Clio, Dacia Sandero, Nissan Micra',
    seats: '5',
  },
  {
    key: 'COMPACT',
    labelHe: 'קומפקטי',
    labelEn: 'Compact',
    examplesHe: 'טויוטה יאריס, ניסאן סנטרה, קיה ריו, הונדה סיטי',
    examplesEn: 'Toyota Yaris, Nissan Sentra, KIA Rio, Honda City',
    seats: '5',
  },
  {
    key: 'CROSSOVER',
    labelHe: 'קרוסאובר',
    labelEn: 'Crossover',
    examplesHe: "קיה ניירו, ניסאן ג'וק, צ'רי FX, MG ZS",
    examplesEn: "KIA Niro, Nissan Juke, Chery FX, MG ZS",
    seats: '5',
  },
  {
    key: 'SUV',
    labelHe: 'SUV',
    labelEn: 'SUV',
    examplesHe: "צ'רי טיגו 7, ניסאן קאשקאי, קיה ספורטאז'",
    examplesEn: 'Chery Tiggo 7, Nissan Qashqai, KIA Sportage',
    seats: '5–7',
  },
  {
    key: 'LUXURY',
    labelHe: 'יוקרה',
    labelEn: 'Luxury',
    examplesHe: 'BMW, מרצדס C 180, אאודי A3',
    examplesEn: 'BMW, Mercedes C 180, Audi A3',
    seats: '5',
  },
  {
    key: 'VAN',
    labelHe: 'ואן / מיניוואן',
    labelEn: 'Van / Minivan',
    examplesHe: "קיה קרנבל, שברולט טרברס, כרייזלר גרנד וויאז'ר",
    examplesEn: 'KIA Carnival, Chevrolet Traverse, Chrysler Grand Voyager',
    seats: '7–8',
  },
  {
    key: 'COMMERCIAL',
    labelHe: 'מסחרי',
    labelEn: 'Commercial',
    examplesHe: "סיטרואן ברלינגו, רנו קנגו, פיאט דובלו",
    examplesEn: 'Citroën Berlingo, Renault Kangoo, Fiat Doblo',
    seats: '2–5',
  },
];

export interface DurationDiscount {
  minDays: number;
  maxDays: number | null;
  discountPct: number;
  labelHe: string;
  labelEn: string;
}

export const DURATION_DISCOUNTS: DurationDiscount[] = [
  { minDays: 60, maxDays: null, discountPct: 15, labelHe: '60 ימים ומעלה', labelEn: '60+ days' },
  { minDays: 30, maxDays: 59,  discountPct: 10, labelHe: '30–59 ימים',    labelEn: '30–59 days' },
  { minDays: 14, maxDays: 29,  discountPct: 7,  labelHe: '14–29 ימים',    labelEn: '14–29 days' },
  { minDays: 1,  maxDays: 13,  discountPct: 0,  labelHe: '1–13 ימים',     labelEn: '1–13 days' },
];

export interface SeasonalRate {
  labelHe: string;
  labelEn: string;
  monthsHe: string;
  monthsEn: string;
  surcharge: number;
}

export const SEASONAL_RATES: SeasonalRate[] = [
  {
    labelHe: 'עונת קיץ',
    labelEn: 'Summer Season',
    monthsHe: 'יולי, אוגוסט',
    monthsEn: 'July, August',
    surcharge: 30,
  },
  {
    labelHe: 'חגים יהודיים',
    labelEn: 'Jewish Holidays',
    monthsHe: 'ראש השנה, יום כיפור, סוכות, פסח, שבועות',
    monthsEn: "Rosh Hashana, Yom Kippur, Sukkot, Pesach, Shavuot",
    surcharge: 20,
  },
  {
    labelHe: 'מחיר סטנדרטי',
    labelEn: 'Standard',
    monthsHe: 'שאר חודשי השנה',
    monthsEn: 'Rest of the year',
    surcharge: 0,
  },
];

/** @deprecated Use calculateByDays instead */
export function getDiscountPct(days: number): number {
  if (days >= 60) return 15;
  if (days >= 30) return 10;
  if (days >= 14) return 7;
  return 0;
}
