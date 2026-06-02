import { z } from 'zod';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

function isValidInternationalPhone(value: string): boolean {
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

export const bookingSchema = z.object({
  vehicleId: z.string().min(1),
  customerName: z.string().min(2, 'Name must be at least 2 characters'),
  customerEmail: z.string().email('Invalid email address'),
  customerPhone: z
    .string()
    .min(1, 'Phone number is required')
    .refine(isValidInternationalPhone, {
      message: 'מספר טלפון לא תקין — הכנס מספר בינלאומי כולל קידומת מדינה (לדוגמה: +1, +44, +972)',
    }),
  customerIdNumber: z
    .string()
    .optional()
    .refine(val => !val || /^\d{1,9}$/.test(val), {
      message: 'מספר תעודת זהות חייב להכיל עד 9 ספרות',
    }),
  pickupDate: z.string().min(1, 'Pickup date is required'),
  dropoffDate: z.string().min(1, 'Drop-off date is required'),
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  dropoffLocation: z.string().min(1, 'Drop-off location is required'),
  notes: z.string().optional(),
  agreeTerms: z.literal(true, {
    message: 'יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להמשיך',
  }),
  marketingConsent: z.boolean().optional(),
}).refine(data => {
  if (!data.pickupDate || !data.dropoffDate) return true;
  return data.dropoffDate > data.pickupDate;
}, {
  message: 'תאריך החזרה חייב להיות אחרי תאריך האיסוף',
  path: ['dropoffDate'],
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
