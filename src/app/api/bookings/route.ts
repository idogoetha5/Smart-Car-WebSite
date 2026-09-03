import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { matchStatusFor } from '@/lib/booking-rules';
import { termsConsent, marketingConsent } from '@/lib/consent';
import { cookies } from 'next/headers';
import { verifyTurnstile } from '@/lib/turnstile';
import { verifyAdminToken } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { getSeasonalPriceRange } from '@/lib/seasonal';
import { getActiveSeasons, getOverridesForVehicle } from '@/lib/db/pricing';
import { bookingRequestSchema } from '@/lib/validations';
import { readJsonBody } from '@/lib/request-body';
import { normalizeEmail } from '@/lib/email';
import { sendTemplateEmail } from '@/lib/email-delivery';
import { formatLocationForCustomer } from '@/lib/location-display';
import { numericOrderReference } from '@/lib/order-reference';
import { normalizeWhatsAppPhone } from '@/lib/rental-quote';
import { isoToday } from '@/lib/rental-quote';
import type { Vehicle } from '@/types';

const EXTRAS_PRICE: Record<string, number> = {
  insurance: 45,
  highway6: 35,
  baby_seat: 20,
  driver: 25,
};

/** Labels for the add-ons listed in the customer emails. */
const EXTRAS_LABELS_HE: Record<string, string> = {
  insurance: 'הפחתה או ביטול השתתפות בנזק',
  highway6:  'חבילת כביש 6 ומנהרות',
  baby_seat: 'כיסא בטיחות לילד',
  driver:    'נהג נוסף',
};


/** Marketing attribution only — never PII, and length-capped. */
function sanitizeAttribution(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const allowed = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'referrer'];
  const out: Record<string, string> = {};
  for (const k of allowed) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return Object.keys(out).length ? out : null;
}

async function checkAdminAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('bookings')
    .select(`*, vehicle:vehicles(make, model, year, image_urls)`)
    .order('created_at', { ascending: false });

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: rlOk, retryAfter } = await checkRateLimit(`booking:${ip}`, 5, 60 * 60 * 1000);
  if (!rlOk) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const supabase = createAdminClient();

  // Bounded and parsed defensively: an unparseable body used to throw out of
  // request.json() and reach the caller as a 500.
  const raw = await readJsonBody(request);
  if (!raw.ok) {
    return NextResponse.json({ error: raw.error }, { status: raw.status });
  }
  const body = raw.value;

  // Turnstile bot check
  if (!await verifyTurnstile(typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  // Honeypot check — bots fill hidden fields, humans don't
  if (body._website) {
    return NextResponse.json({ data: { id: 'bot' } }, { status: 201 }); // silent reject
  }

  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid booking data' },
      { status: 400 }
    );
  }

  // Everything below reads `input`, never `body`. The raw body is not
  // touched again past this point — that is the whole guarantee.
  const input = parsed.data;

  const vehicleId    = input.vehicleId;
  const pickupDate   = input.pickupDate;
  const dropoffDate  = input.dropoffDate;

  // Validate dates server-side
  if (!pickupDate || !dropoffDate) {
    return NextResponse.json({ error: 'Pickup and drop-off dates are required' }, { status: 400 });
  }
  if (dropoffDate <= pickupDate) {
    return NextResponse.json({ error: 'Drop-off date must be after pickup date' }, { status: 400 });
  }
  // Both sides are YYYY-MM-DD, so a plain string compare avoids Date-object
  // timezone parsing entirely; isoToday() itself is already Asia/Jerusalem —
  // see its docstring for why toISOString() alone rolls back a day right
  // after UTC midnight.
  if (pickupDate < isoToday()) {
    return NextResponse.json({ error: 'Pickup date cannot be in the past' }, { status: 400 });
  }

  // NOTE: booking submissions are REQUESTS, not reservations — the online
  // catalog shows only part of the company's fleet, so an apparent
  // conflict here must never block a customer from submitting. A request
  // is always saved and a representative checks the full fleet (same
  // group / similar vehicle). The real availability gate is admin
  // approval, which re-checks conflicts against total_units atomically
  // (see api/admin/bookings/[id]/route.ts).

  const totalDays = Math.ceil(
    (new Date(dropoffDate).getTime() - new Date(pickupDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Fetch vehicle to calculate server-side price
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select('make, model, year, price_per_day, category, is_available')
    .eq('id', vehicleId)
    .single();

  if (vehicleError || !vehicle) {
    return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
  }

  // Deliberately NOT a rejection. is_available reflects the online catalogue,
  // which holds only part of the fleet, so it cannot establish that no vehicle
  // exists — and the note above says as much. Returning 409 here contradicted
  // that and turned a serious customer into a dead end. The request is saved
  // and flagged instead, and staff match it against the full fleet.
  const manualMatch = matchStatusFor(vehicle.is_available, input.manualMatchRequired === true);

  if (!vehicle.price_per_day || vehicle.price_per_day <= 0) {
    return NextResponse.json({ error: 'Vehicle pricing is not configured' }, { status: 422 });
  }

  // Calculate authoritative price server-side (mirrors BookingForm logic).
  // Priced per-day across the full range so a rental crossing a season
  // boundary (e.g. June → July) is charged the correct rate for each day.
  const vehicleForPricing: Pick<Vehicle, 'id' | 'pricePerDay'> = { id: vehicleId, pricePerDay: vehicle.price_per_day };
  const [seasons, overrides] = await Promise.all([
    getActiveSeasons(),
    getOverridesForVehicle(vehicleId),
  ]);
  const { subtotal, avgPricePerDay: serverPricePerDay } = getSeasonalPriceRange(
    vehicleForPricing,
    { seasons, overrides },
    new Date(pickupDate),
    new Date(dropoffDate)
  );
  const discountPct = totalDays >= 60 ? 15 : totalDays >= 30 ? 10 : totalDays >= 14 ? 7 : 0;
  const serverDiscount = Math.round(subtotal * discountPct / 100);
  const vehicleTotal = subtotal - serverDiscount;
  const selectedExtras: string[] = input.extras ?? [];
  const extrasTotal = selectedExtras.reduce((sum, id) => sum + (EXTRAS_PRICE[id] ?? 0) * totalDays, 0);
  const serverTotalPrice = vehicleTotal + extrasTotal;

  // Consent wording is derived here, never taken from the request body.
  const terms = termsConsent(input.locale);
  const marketing = marketingConsent(input.locale);

  // Map camelCase → snake_case for Supabase insert
  const { data, error } = await supabase
    .from('bookings')
    .insert([{
      vehicle_id:          vehicleId,
      customer_name:       input.customerName,
      customer_email:      normalizeEmail(input.customerEmail),
      customer_phone:      input.customerPhone,
      customer_phone_normalized: normalizeWhatsAppPhone(input.customerPhone),
      customer_id_number:  input.customerIdNumber ?? null,
      pickup_date:         pickupDate,
      dropoff_date:        dropoffDate,
      pickup_location:     input.pickupLocation,
      dropoff_location:    input.dropoffLocation,
      notes:               input.notes ?? null,
      extras:              selectedExtras,
      additional_driver_name: input.additionalDriverName ?? null,
      // Consent ledger — evidence of exactly what the customer agreed to,
      // when, in which language and from where. The text hashes pin the
      // wording that was on screen, so a later edit to the terms or the
      // marketing line cannot be confused with what was actually accepted.
      // Wording chosen server-side from the verified locale. It used to hash
      // the Hebrew sentence unconditionally, so an English customer got a
      // ledger entry proving text they were never shown.
      terms_version:       input.agreeTerms === true ? terms.version : null,
      terms_text_hash:     input.agreeTerms === true ? terms.hash : null,
      terms_accepted_at:   input.agreeTerms === true ? new Date().toISOString() : null,
      marketing_consent:   input.marketingConsent === true,
      marketing_text_hash: input.marketingConsent === true ? marketing.hash : null,
      consent_locale:      terms.locale,
      consent_source:      'booking_form',
      attribution:         sanitizeAttribution(input.attribution),
      // Set when the customer asked for a vehicle the online catalogue
      // could not match — staff check the full fleet for an equivalent.
      // Derived on the server from is_available, not taken on trust from the
      // browser: a client that omits the flag must not be able to hide that a
      // request needs a human to match it.
      match_status:        manualMatch,
      total_days:          totalDays,
      total_price:         serverTotalPrice,
      price_per_day:       serverPricePerDay,
      pickup_time:         input.pickup_time ?? '09:00',
      return_time:         input.return_time ?? '09:00',
      status:              'PENDING',
    }])
    .select()
    .single();

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }

  // "Booking request received" email — sent server-side, exactly once per
  // successfully created booking (this is a separate EmailJS template from
  // the "booking confirmed" one, which is only sent by the admin route on
  // the transition into CONFIRMED). Failure is non-fatal: the booking is
  // already saved; the response tells the client whether the email went out
  // so the confirmation page never claims an email that wasn't sent.
  const emailSent = await sendRequestReceivedEmail({
    booking: data,
    vehicle: { make: vehicle.make, model: vehicle.model, year: vehicle.year },
    totalDays,
  });

  // A minimal DTO, not the inserted row. The row carries the customer's name,
  // email, phone, ID/passport number, notes and the whole consent ledger, and
  // returning it put all of that into browser network logs, monitoring tools
  // and any extension watching XHR. The confirmation screen needs an id and a
  // status; it never needed the rest.
  return NextResponse.json(
    { data: { id: data.id, status: data.status, matchStatus: data.match_status }, emailSent },
    { status: 201 },
  );
}

function formatDateHe(dateStr: string): string {
  const datePart = String(dateStr).split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/**
 * Mirrors getRentalMileageAllowance() in BookingForm.tsx and the tiers
 * published on /terms — 1–7 days: 200 km/day; 8–30 days: 220 km/day;
 * over 30 days: 2,500 km per 30-day period.
 */
function formatMileageAllowanceHe(totalDays: number): string {
  if (totalDays <= 7)  return `${200 * totalDays} ק"מ (200 ק"מ ליום)`;
  if (totalDays <= 30) return `${220 * totalDays} ק"מ (220 ק"מ ליום)`;
  const periods = Math.ceil(totalDays / 30);
  return `${2500 * periods} ק"מ (2,500 ק"מ לכל 30 יום)`;
}

const LOGO_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png';

// EmailJS substitutes {{var}} as plain text only — it does NOT render HTML
// embedded inside a variable's value (confirmed the hard way: an earlier
// version of this function built full <div>/<p> markup as a string and
// passed it through {{details_block}}, and customers received the literal
// "<div style=..." markup as visible text). So the template below has every
// row hard-coded as fixed HTML, and each office-only row carries a
// {{office_only}} placeholder in its own `style` attribute — that
// placeholder is still just plain text (either the string "display:none" or
// an empty string), never a tag. `office_only`/`customer_only` are the only
// switch between what the two recipients see.
async function sendRequestReceivedEmail({
  booking,
  vehicle,
  totalDays,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  booking: any;
  vehicle: { make: string; model: string; year: number };
  totalDays: number;
}): Promise<boolean> {
  const orderId = numericOrderReference(String(booking.id));
  // The year is deliberately left off the customer's copy — customers found
  // it confusing next to the model name. Staff still get it, since it's
  // relevant when matching against the full fleet.
  const vehicleNameCustomer = `${vehicle.make} ${vehicle.model}`;
  const vehicleNameOffice = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const startDate = formatDateHe(booking.pickup_date);
  const endDate = formatDateHe(booking.dropoff_date);
  const pickupLocation = formatLocationForCustomer(booking.pickup_location);
  const returnLocation = formatLocationForCustomer(booking.dropoff_location || booking.pickup_location);
  const extrasText = Array.isArray(booking.extras) && booking.extras.length > 0
    ? booking.extras.map((e: string) => EXTRAS_LABELS_HE[e] ?? e).join(', ')
    : 'ללא';
  const totalPriceText = booking.total_price
    ? `₪${Number(booking.total_price).toLocaleString()} (מחיר משוער)`
    : 'יימסר על ידי נציג';

  const sharedParams = {
    order_id:         orderId,
    // The EmailJS "request received" template (template_ngg6hyf) wraps this
    // in its own subject line:
    //   קיבלנו את בקשת ה{{booking_type}} שלך – {{vehicle_name}} | SmartCar
    // so this must be a short noun, not a sentence.
    booking_type:      'השכרה',
    pickup_location:   pickupLocation,
    return_location:   returnLocation,
    customer_phone:    booking.customer_phone,
    total_price:       totalPriceText,
    logo_url:          LOGO_URL,
  };
  // Staff need the exact collection/return time to plan handover, so the
  // office's date lines carry it; the customer's copy keeps the plain date.
  const pickupTime = booking.pickup_time || '09:00';
  const returnTime = booking.return_time || '09:00';

  // Both recipients are independent — sent concurrently so the customer's
  // response time isn't doubled by a second sequential EmailJS round trip.
  const [{ ok }, officeResult] = await Promise.all([
    sendTemplateEmail({
      event: 'booking_request_received',
      // One receipt per booking, whatever happens upstream.
      idempotencyKey: `booking_request_received:${booking.id}`,
      templateId: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
      params: {
        ...sharedParams,
        to_email:     booking.customer_email,
        to_name:      booking.customer_name,
        vehicle_name: vehicleNameCustomer,
        start_date:   startDate,
        end_date:     endDate,
        heading:      'תודה, הבקשה שלך אצלנו',
        intro_text:   'תודה שבחרת ב-SmartCar! הבקשה שלך התקבלה אצלנו בהצלחה. נציג מהצוות שלנו כבר עובר על הפרטים וייצור איתך קשר בהקדם כדי להתקדם בתהליך ההשכרה.',
        // Rows/notice marked office_only are hidden for the customer;
        // customer_only stays visible. Values still required even when
        // hidden — the template has no notion of "leave this field blank".
        office_only:   'display:none',
        customer_only: '',
        customer_name: '', customer_email: '', id_number: '', total_days: '',
        mileage_allowance: '', extras: '', additional_driver: '', notes: '',
      },
    }),
    sendTemplateEmail({
      event: 'booking_request_received',
      idempotencyKey: `booking_request_received_office:${booking.id}`,
      templateId: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
      params: {
        ...sharedParams,
        to_email:     'office@smartcar.co.il',
        to_name:      'צוות SmartCar',
        vehicle_name: vehicleNameOffice,
        start_date:   `${startDate} בשעה ${pickupTime}`,
        end_date:     `${endDate} בשעה ${returnTime}`,
        heading:      'התקבלה בקשת השכרה חדשה',
        intro_text:   'התקבלה בקשת הזמנה חדשה מהאתר. פרטי הבקשה המלאים:',
        office_only:   '',
        customer_only: 'display:none',
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        id_number:     booking.customer_id_number || 'לא נמסר',
        total_days:    String(totalDays),
        mileage_allowance: formatMileageAllowanceHe(totalDays),
        extras:        extrasText,
        additional_driver: booking.additional_driver_name || 'ללא',
        notes:         booking.notes || 'ללא',
      },
    }),
  ]);
  if (!officeResult.ok) {
    console.error('[bookings] office notification email failed for booking', booking.id);
  }

  return ok;
}
