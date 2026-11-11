import { z } from 'zod';

export const ROAD_TYPES = ['straight', 'intersection', 't_junction', 'roundabout'] as const;
export type RoadType = (typeof ROAD_TYPES)[number];

export const DAMAGE_ZONES = [
  'front',
  'front_right',
  'hood',
  'front_left',
  'rear_right',
  'roof',
  'rear_left',
  'trunk',
  'rear',
] as const;
export type DamageZone = (typeof DAMAGE_ZONES)[number];

export const INSURERS = [
  'harel',
  'migdal',
  'clal',
  'phoenix',
  'menora',
  'ayalon',
  'hachshara',
  'direct',
  'aig',
  'shomera',
  'libra',
  'other',
] as const;
export type Insurer = (typeof INSURERS)[number];

export const INSURER_LABELS: Record<Insurer, { he: string; en: string }> = {
  harel: { he: 'הראל', en: 'Harel' },
  migdal: { he: 'מגדל', en: 'Migdal' },
  clal: { he: 'כלל', en: 'Clal' },
  phoenix: { he: 'הפניקס', en: 'The Phoenix' },
  menora: { he: 'מנורה מבטחים', en: 'Menora Mivtachim' },
  ayalon: { he: 'איילון', en: 'Ayalon' },
  hachshara: { he: 'הכשרה', en: 'Hachshara' },
  direct: { he: 'ביטוח ישיר', en: 'Direct Insurance' },
  aig: { he: 'AIG', en: 'AIG' },
  shomera: { he: 'שומרה', en: 'Shomera' },
  libra: { he: 'ליברה', en: 'Libra' },
  other: { he: 'חברה אחרת', en: 'Another company' },
};

export const ROAD_LABELS: Record<RoadType, { he: string; en: string }> = {
  straight: { he: 'כביש ישר', en: 'Straight road' },
  intersection: { he: 'צומת', en: 'Intersection' },
  t_junction: { he: 'צומת T', en: 'T-intersection' },
  roundabout: { he: 'כיכר', en: 'Roundabout' },
};

export const ZONE_LABELS: Record<DamageZone, { he: string; en: string }> = {
  front: { he: 'חזית', en: 'Front' },
  front_right: { he: 'קדמי ימין', en: 'Front right' },
  hood: { he: 'מכסה מנוע', en: 'Hood' },
  front_left: { he: 'קדמי שמאל', en: 'Front left' },
  rear_right: { he: 'אחורי ימין', en: 'Rear right' },
  roof: { he: 'גג', en: 'Roof' },
  rear_left: { he: 'אחורי שמאל', en: 'Rear left' },
  trunk: { he: 'תא מטען', en: 'Trunk' },
  rear: { he: 'אחור', en: 'Rear' },
};

/* ---------- field validators (shared by the form and the server) ---------- */

export const digits = (s: string) => s.replace(/\D/g, '');

/** Israeli ID number with check digit. */
export function isValidIsraeliId(raw: string): boolean {
  const d = digits(raw);
  if (d.length < 5 || d.length > 9) return false;
  const id = d.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(id[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

/** Israeli phone: 9–10 digits starting with 0 (or +972). */
function isIsraeliPhone(raw: string): boolean {
  let d = digits(raw);
  if (d.startsWith('972')) d = '0' + d.slice(3);
  return /^0\d{8,9}$/.test(d);
}

/**
 * International phone with country code, for tourists: "+44 7700 900123",
 * "0044…" or the bare digits "971503343353". 10–15 digits after the country
 * code prefix; a leading single 0 means a local Israeli number instead.
 */
function isInternationalPhone(raw: string): boolean {
  let d = digits(raw);
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) return false;
  return d.length >= 10 && d.length <= 15;
}

/** Israeli or international phone number. */
export function isValidPhone(raw: string): boolean {
  return isIsraeliPhone(raw) || isInternationalPhone(raw);
}

/** Israeli numbers as typed; international ones as "+<digits>" so the office can dial them. */
export function normalizePhone(raw: string): string {
  const t = raw.trim();
  if (isIsraeliPhone(t) || !isInternationalPhone(t)) return t;
  let d = digits(t);
  if (d.startsWith('00')) d = d.slice(2);
  return `+${d}`;
}

export type IdType = 'il' | 'passport';

/** Passport number: letters and digits only, 5–20 characters. */
export function normalizePassport(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}
export function isValidPassport(raw: string): boolean {
  return /^[A-Z0-9]{5,20}$/.test(normalizePassport(raw));
}

/** Israeli ID (check digit) or, for tourists, a passport number. */
export function isValidIdOf(type: IdType | undefined, raw: string): boolean {
  return type === 'passport' ? isValidPassport(raw) : isValidIsraeliId(raw);
}

export function isValidPlate(raw: string): boolean {
  const d = digits(raw);
  return d.length >= 5 && d.length <= 8;
}

export function isValidLicenseNumber(raw: string): boolean {
  const d = digits(raw);
  return d.length >= 5 && d.length <= 9;
}

/** Formats Israeli plates the way they appear on the car: 12-345-67 / 123-45-678 */
export function formatPlate(raw: string): string {
  const d = digits(raw);
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  return raw.trim();
}

export function isValidDateParts(d: string, m: string, y: string): boolean {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const last = new Date(year, month, 0).getDate();
  return day <= last;
}

/* ---------- submitted payload ---------- */

const str = (max = 300) => z.string().trim().max(max);
const req = (max = 300) => z.string().trim().min(1).max(max);
const storagePath = z.string().max(300).regex(/^uploads\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/);

export const reportSchema = z
  .object({
    locale: z.enum(['he', 'en']),
    draftId: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
    branch: str(40).optional(),
    linkToken: str(80).optional(),
    car: z.object({
      plate: req(20).refine(isValidPlate),
      model: req(80),
    }),
    driver: z.object({
      name: req(120),
      idType: z.enum(['il', 'passport']).default('il'),
      idNumber: req(20),
      phone: req(20).refine(isValidPhone),
      address: req(200),
      email: z.union([z.literal(''), z.string().trim().email().max(160)]),
      licenseNumber: req(12).refine(isValidLicenseNumber),
      licenseExpiry: z.object({ d: req(2), m: req(2), y: req(4) }).refine((v) => isValidDateParts(v.d, v.m, v.y)),
      licensePhoto: storagePath.optional(),
    }),
    accident: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      location: req(200),
      roadType: z.enum(ROAD_TYPES),
      description: req(3000),
      injured: z.boolean(),
      police: z.boolean(),
      policeStation: str(120),
      policeReport: str(40),
    }),
    other: z.object({
      involved: z.boolean(),
      plate: str(20),
      model: str(80),
      insurer: z.union([z.enum(INSURERS), z.literal('')]),
      insurerOther: str(80),
      policy: str(60),
      agent: str(120),
      ownerName: str(120),
      ownerIdType: z.enum(['il', 'passport']).default('il'),
      ownerId: str(20),
      ownerPhone: str(20),
      ownerAddress: str(200),
      docsPhoto: storagePath.optional(),
    }),
    damage: z.object({
      zones: z.array(z.enum(DAMAGE_ZONES)).max(9),
      ours: req(1000),
      theirs: str(1000),
    }),
    photos: z.array(storagePath).max(10),
    signature: z.string().startsWith('data:image/png;base64,').max(400_000),
    declaration: z.literal(true),
    turnstileToken: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!isValidIdOf(v.driver.idType, v.driver.idNumber)) {
      ctx.addIssue({ code: 'custom', path: ['driver', 'idNumber'], message: 'invalid id' });
    }
    if (v.accident.police && (!v.accident.policeStation || !v.accident.policeReport)) {
      ctx.addIssue({ code: 'custom', path: ['accident', 'policeStation'], message: 'police details required' });
    }
    if (v.other.involved) {
      const o = v.other;
      const missing =
        !isValidPlate(o.plate) ||
        !o.model ||
        !o.insurer ||
        (o.insurer === 'other' && !o.insurerOther) ||
        !o.policy ||
        !o.ownerName ||
        !isValidIdOf(o.ownerIdType, o.ownerId) ||
        (!!o.ownerPhone && !isValidPhone(o.ownerPhone)) ||
        !o.ownerAddress ||
        !v.damage.theirs;
      if (missing) ctx.addIssue({ code: 'custom', path: ['other'], message: 'other party details required' });
    }
    for (const p of [...v.photos, v.driver.licensePhoto, v.other.docsPhoto]) {
      if (p && !p.startsWith(`uploads/${v.draftId}/`)) {
        ctx.addIssue({ code: 'custom', path: ['photos'], message: 'invalid upload path' });
      }
    }
  });

export type ReportPayload = z.infer<typeof reportSchema>;

/** What we keep in the `data` column (no signature blob, no turnstile token). */
export type StoredReport = Omit<ReportPayload, 'signature' | 'turnstileToken'> & {
  signaturePath: string;
  submittedAt: string;
};

export function insurerName(r: Pick<StoredReport['other'], 'insurer' | 'insurerOther'>, lang: 'he' | 'en' = 'he') {
  if (!r.insurer) return '';
  if (r.insurer === 'other') return r.insurerOther;
  return INSURER_LABELS[r.insurer][lang];
}
