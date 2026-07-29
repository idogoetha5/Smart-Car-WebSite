import { z } from 'zod';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function isValidInternationalPhone(value: string): boolean {
  const cleaned = value.trim();
  if (!cleaned) return false;
  // Accept Israeli numbers without country code (starts with 05 or 0)
  if (/^0\d/.test(cleaned)) {
    return isValidPhoneNumber(cleaned, 'IL');
  }
  try {
    const phone = parsePhoneNumber(cleaned);
    return phone.isValid();
  } catch {
    return false;
  }
}

/**
 * The fields the booking form itself renders. Shared so the browser and the
 * API cannot drift into validating different things.
 */
const bookingFormFields = {
  vehicleId: z.string().min(1).max(64),
  customerName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  customerEmail: z.string().email('Invalid email address').max(254),
  customerPhone: z
    .string()
    .min(1, 'Phone number is required')
    .max(32)
    .refine(isValidInternationalPhone, {
      message: 'מספר טלפון לא תקין — הכנס מספר בינלאומי כולל קידומת מדינה (לדוגמה: +1, +44, +972)',
    }),
  customerIdNumber: z
    .string()
    .optional()
    .refine(val => !val || /^\d{1,9}$/.test(val), {
      message: 'מספר תעודת זהות חייב להכיל עד 9 ספרות',
    }),
  pickupDate: z.string().min(1, 'Pickup date is required').max(32),
  dropoffDate: z.string().min(1, 'Drop-off date is required').max(32),
  pickupLocation: z.string().min(1, 'Pickup location is required').max(200),
  dropoffLocation: z.string().min(1, 'Drop-off location is required').max(200),
  notes: z.string().max(2000).optional(),
  agreeTerms: z.literal(true, {
    message: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך',
  }),
  marketingConsent: z.boolean().optional(),
};

/** Drop-off must come after pickup. Applied to both shapes below. */
const dropoffAfterPickup = (data: { pickupDate?: string; dropoffDate?: string }) => {
  if (!data.pickupDate || !data.dropoffDate) return true;
  return data.dropoffDate > data.pickupDate;
};

const dropoffAfterPickupError = {
  message: 'תאריך החזרה חייב להיות אחרי תאריך האיסוף',
  path: ['dropoffDate'],
};

export const bookingSchema = z
  .object(bookingFormFields)
  .refine(dropoffAfterPickup, dropoffAfterPickupError);

/** Add-ons the server knows how to price. Anything else is not an add-on. */
export const BOOKING_EXTRAS = ['insurance', 'highway6', 'baby_seat', 'driver'] as const;

/**
 * What `POST /api/bookings` accepts — every key, not just the form's.
 *
 * The route used to validate the form fields and then go on to read
 * `extras`, `locale`, `pickup_time`, `return_time`, `manualMatchRequired`,
 * `additionalDriverName` and `attribution` straight off the raw body, so
 * seven values reached the insert without ever being checked. Strict, so a
 * key nobody declared is a rejected request rather than a silent surprise.
 */
export const bookingRequestSchema = z
  .strictObject({
    ...bookingFormFields,

    turnstileToken: z.string().max(4096).optional(),
    // Hidden field no real person fills in. It has to be declared or strict
    // mode would reject the bot before the honeypot got to notice it.
    _website: z.string().max(200).optional(),

    extras: z.array(z.enum(BOOKING_EXTRAS)).max(BOOKING_EXTRAS.length).optional(),
    additionalDriverName: z.string().max(100).optional(),

    locale: z.enum(['he', 'en']).optional(),
    pickup_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid pickup time').optional(),
    return_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid return time').optional(),

    manualMatchRequired: z.boolean().optional(),
    // Marketing parameters only. Narrowed again server-side to a fixed
    // allowlist before anything is stored.
    attribution: z.record(z.string().max(40), z.string().max(500)).optional(),

    // Sent by the form, deliberately ignored: the server recalculates the
    // price from the vehicle and the dates and never trusts a number the
    // browser supplies. Declared purely so strict mode does not 400 a
    // perfectly good booking.
    totalPrice: z.number().optional(),
    pricePerDay: z.number().optional(),
    couponCode: z.string().max(64).optional(),
    couponDiscount: z.number().optional(),
  })
  .refine(dropoffAfterPickup, dropoffAfterPickupError);

/**
 * What `POST /api/contact` accepts.
 *
 * The route used to coerce each field with `String(body.x ?? '').slice(...)`,
 * which truncates rather than refuses and never looked at the shape of
 * anything: an unparseable phone number or "not-an-email" was stored and
 * emailed exactly as typed. `type="email"` in the browser is not a check —
 * nothing stops a direct POST.
 *
 * Trimming happens here so length limits apply to the real content and a
 * message of 4000 spaces is not a valid enquiry.
 */
export const contactSchema = z.strictObject({
  name: z.string().trim().min(2, 'שם קצר מדי').max(100, 'שם ארוך מדי'),
  phone: z
    .string()
    .trim()
    .min(1, 'טלפון הוא שדה חובה')
    .max(30)
    .refine(isValidInternationalPhone, { message: 'מספר טלפון לא תקין' }),
  // Optional, and the form posts '' when it is left blank — so an empty
  // string has to be as acceptable as an omitted key.
  email: z
    .union([z.literal(''), z.string().trim().email('כתובת דוא"ל לא תקינה').max(254)])
    .optional(),
  message: z.string().trim().min(1, 'ההודעה ריקה').max(4000, 'ההודעה ארוכה מדי'),
  turnstileToken: z.string().max(4096).optional(),
  _website: z.string().max(200).optional(),
});

export const leasingSchema = z.object({
  vehicleId: z.string().min(1, 'Please select a vehicle'),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z
    .string()
    .min(1, 'Phone number is required')
    .refine(isValidInternationalPhone, {
      message: 'מספר טלפון לא תקין — הכנס מספר בינלאומי כולל קידומת מדינה',
    }),
  companyName: z.string().optional(),
  durationMonths: z.number().min(12).max(60),
  downPayment: z.number().min(0),
  mileagePackage: z.number().min(10000),
  notes: z.string().optional(),
});

export const vehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().min(2000).max(2030),
  category: z.enum([
    'MINI',
    'ECONOMY',
    'COMPACT',
    'SEDAN',
    'CROSSOVER',
    'SUV',
    'LUXURY',
    'VAN',
    'COMMERCIAL',
    'ELECTRIC',
  ]),
  transmission: z.enum(['AUTOMATIC', 'MANUAL']),
  fuelType: z.enum(['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID']),
  seats: z.number().min(2).max(9),
  doors: z.number().min(2).max(5),
  pricePerDay: z.number().positive(),
  pricePerMonth: z.number().positive(),
  depositAmount: z.number().min(0),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  totalUnits: z.number().min(1).default(1),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type LeasingInput = z.infer<typeof leasingSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
