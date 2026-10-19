import { getVehicles } from '@/lib/db/vehicles';

let cached: { at: number; rows: Awaited<ReturnType<typeof getVehicles>> } | null = null;
let loading: Promise<Awaited<ReturnType<typeof getVehicles>>> | null = null;

/** Public specs only. Rental prices must use the existing date/season engine. */
export async function getWhatsAppCatalogueFacts(message: string, locale: 'he' | 'en'): Promise<string> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return '';
  if (!/רכב|רכבים|דגם|מקומות|מושבים|אוטומט|חשמלי|בנזין|סולר|kia|toyota|bmw|mercedes|hyundai|mazda|skoda|ford|car\b|cars\b|vehicle|model|seats?|automatic|electric|diesel/i.test(message)) return '';
  try {
    if (!cached || Date.now() - cached.at > 60_000) {
      loading ??= getVehicles({ isAvailable: true }).then((rows) => {
        cached = { at: Date.now(), rows };
        return rows;
      }).finally(() => { loading = null; });
      // A database issue must not hold the conversation hostage.
      const rows = await Promise.race([loading, new Promise<null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 1800);
        timer.unref?.();
      })]);
      if (!rows) return '';
    }
    const words = message.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2);
    const rows = [...(cached?.rows ?? [])].sort((a, b) => {
      const score = (v: typeof a) => words.filter((word) => `${v.make} ${v.model} ${v.category} ${v.fuelType}`.toLowerCase().includes(word)).length;
      return score(b) - score(a);
    }).slice(0, 20);
    if (!rows.length) return '';
    const specs = rows.map((v) => `${v.make} ${v.model} (${v.year}); ${v.seats} seats; ${v.transmission}; ${v.fuelType}; category ${v.category}. https://www.smartcar.co.il/${locale}/rental/${v.id}`).join('\n');
    return `${locale === 'he' ? 'מפרט מהקטלוג — לא אישור זמינות לתאריכים או מחיר סופי:' : 'Catalogue specifications — not date-specific availability or final pricing:'}\n${specs}`;
  } catch {
    return '';
  }
}
