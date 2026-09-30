import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { verifyInspectionToken } from '@/lib/inspection-link';
import { sendTemplateEmail } from '@/lib/email-delivery';
import { renderInspectionPdf } from '@/lib/inspection-pdf-server';
import { INSPECTION_DECLARATION } from '@/lib/inspection-declaration';
import {
  INSPECTION_BUCKET,
  inspectionSignaturePath,
  inspectionPdfPath,
  fuelEighthsToLabel,
} from '@/lib/inspection-storage';
import { numericOrderReference } from '@/lib/order-reference';
import { sendInspectionOfficeEmail } from '@/lib/inspection-office-email';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';

// Renders the signed PDF with headless Chromium, then emails the office.
export const maxDuration = 60;

const LOGO_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png';

type InspectionRow = {
  id: string;
  type: 'pickup' | 'return';
  odometer_km: number;
  fuel_eighths: number;
  status: 'awaiting_signature' | 'signed';
  signed_at: string | null;
  video_sha256: string | null;
  booking: {
    id: string;
    customer_name: string;
    customer_email: string;
    custom_vehicle_name: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
  driver: { name: string } | null;
};

/** Loads what the signing page needs to display, for a validly-signed token. */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit } = await checkRateLimit(`inspection-sign:${ip}`, 30, 60 * 60 * 1000);
  if (!withinLimit) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const token = request.nextUrl.searchParams.get('token');
  const link = verifyInspectionToken(token);
  if (!link.valid) {
    return NextResponse.json(
      { error: link.reason === 'expired' ? 'expired' : 'invalid' },
      { status: link.reason === 'expired' ? 410 : 404 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, type, odometer_km, fuel_eighths, status, signed_at, video_sha256, booking:bookings(id, customer_name, customer_email, custom_vehicle_name, vehicle:vehicles(make, model, license_plate))'
    )
    .eq('id', link.inspectionId!)
    .maybeSingle<InspectionRow>();

  if (error) {
    console.error('[inspections/sign][GET] lookup failed:', error.message);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      inspectionId: data.id,
      type: data.type,
      odometerKm: data.odometer_km,
      fuelLabel: fuelEighthsToLabel(data.fuel_eighths),
      status: data.status,
      signedAt: data.signed_at,
      customerName: data.booking?.customer_name ?? '',
      vehicleName: bookingVehicleName(data.booking),
      licensePlate: bookingLicensePlate(data.booking),
      declaration: INSPECTION_DECLARATION[data.type],
      videoReady: Boolean(data.video_sha256),
    },
  });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit, retryAfter } = await checkRateLimit(`inspection-sign-submit:${ip}`, 5, 60 * 60 * 1000);
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'יותר מדי בקשות. נסו שוב מאוחר יותר.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const body = await request.json().catch(() => null);
  const link = verifyInspectionToken(body?.token);
  if (!link.valid) {
    return NextResponse.json(
      { error: link.reason === 'expired' ? 'הקישור פג תוקף.' : 'קישור לא תקין.' },
      { status: link.reason === 'expired' ? 410 : 404 }
    );
  }

  if (!await verifyTurnstile(body?.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  const signatureDataUrl = String(body?.signatureDataUrl ?? '');
  const match = signatureDataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: 'חתימה חסרה או לא תקינה.' }, { status: 400 });
  }
  if (!body?.declarationAccepted) {
    return NextResponse.json({ error: 'יש לאשר את ההצהרה לפני החתימה.' }, { status: 400 });
  }

  const inspectionId = link.inspectionId!;
  const supabase = createAdminClient();
  const signerIp = ip;
  const signerUserAgent = request.headers.get('user-agent') ?? '';

  // Atomic, status-guarded transition — this is what makes signing
  // single-use even though the link itself stays valid (and viewable)
  // afterward. A second attempt updates zero rows.
  const { data: signedRows, error: signError } = await supabase
    .from('vehicle_inspections')
    .update({ status: 'signed', signed_at: new Date().toISOString(), signer_ip: signerIp, signer_user_agent: signerUserAgent })
    .eq('id', inspectionId)
    .eq('status', 'awaiting_signature')
    .select(
      'id, type, odometer_km, fuel_eighths, video_sha256, signed_at, booking:bookings(id, customer_name, customer_email, custom_vehicle_name, vehicle:vehicles(make, model, license_plate)), driver:drivers(name)'
    )
    .returns<InspectionRow[]>();

  if (signError) {
    console.error('[inspections/sign][POST] update failed:', signError.message);
    return NextResponse.json({ error: 'שמירת החתימה נכשלה. נסה שוב.' }, { status: 500 });
  }

  if (!signedRows || signedRows.length === 0) {
    const { data: existing } = await supabase
      .from('vehicle_inspections')
      .select('signed_at')
      .eq('id', inspectionId)
      .maybeSingle();
    return NextResponse.json(
      {
        error: existing?.signed_at
          ? `הבדיקה כבר נחתמה בתאריך ${new Date(existing.signed_at).toLocaleString('he-IL')}.`
          : 'הבדיקה לא נמצאה.',
      },
      { status: 409 }
    );
  }

  const inspection = signedRows[0] as unknown as InspectionRow & { signed_at: string };
  const booking = inspection.booking;

  // Best-effort: flips the matching driver task (if any) to 'done' — never
  // blocks or fails the signing response. A booking with no task (e.g. the
  // admin inspection flow without the driver-tasks feature) just has
  // nothing to update here.
  if (booking?.id) {
    const { error: taskUpdateError } = await supabase
      .from('driver_tasks')
      .update({ status: 'done' })
      .eq('booking_id', booking.id)
      .eq('type', inspection.type)
      .eq('status', 'open');
    if (taskUpdateError) {
      console.error('[inspections/sign][POST] task status update failed:', taskUpdateError.message);
    }
  }

  const signatureBuffer = Buffer.from(match[1], 'base64');
  const signaturePath = inspectionSignaturePath(inspectionId);
  const { error: sigUploadError } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .upload(signaturePath, signatureBuffer, { contentType: 'image/png', upsert: true });
  if (sigUploadError) {
    console.error('[inspections/sign][POST] signature upload failed:', sigUploadError.message);
  }

  const bookingNumber = numericOrderReference(booking?.id ?? inspectionId);
  const pdfBuffer = await renderInspectionPdf({
    inspectionId,
    bookingId: booking?.id ?? '',
    bookingNumber,
    customerName: booking?.customer_name ?? '',
    vehicleName: bookingVehicleName(booking),
    licensePlate: bookingLicensePlate(booking),
    type: inspection.type,
    odometerKm: inspection.odometer_km,
    fuelEighths: inspection.fuel_eighths,
    declarationText: INSPECTION_DECLARATION[inspection.type].he,
    videoSha256: inspection.video_sha256 ?? '',
    signedAt: inspection.signed_at,
    signerIp,
    signatureDataUrl,
    driverName: inspection.driver?.name,
  });

  const pdfPath = inspectionPdfPath(inspectionId);
  const { error: pdfUploadError } = await supabase.storage
    .from(INSPECTION_BUCKET)
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (pdfUploadError) {
    console.error('[inspections/sign][POST] PDF upload failed:', pdfUploadError.message);
  } else {
    await supabase.from('vehicle_inspections').update({ signed_pdf_path: pdfPath }).eq('id', inspectionId);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';
  const pdfLink = `${baseUrl}/insp-pdf/${encodeURIComponent(body.token)}`;
  const typeLabel = inspection.type === 'pickup' ? 'קבלת הרכב' : 'החזרת הרכב';

  if (booking?.customer_email) {
    await sendTemplateEmail({
      event: 'vehicle_inspection_signed',
      idempotencyKey: `vehicle_inspection_signed:${inspectionId}`,
      templateId: process.env.NEXT_PUBLIC_EMAILJS_INSPECTION_SIGNED_TEMPLATE_ID,
      params: {
        to_email: booking.customer_email,
        to_name: booking.customer_name,
        vehicle_name: bookingVehicleName(booking),
        inspection_type: typeLabel,
        pdf_link: pdfLink,
        logo_url: LOGO_URL,
      },
    });
  }

  // Internal notification to the office — independent of whether the
  // customer email above succeeded, or whether the booking even has a
  // customer email at all. Any failure here is queued in
  // inspection_office_outbox for the daily cron sweep to retry, same as
  // the EmailJS outbox above but via its own table since this send goes
  // through Resend with a PDF attachment (see sendInspectionOfficeEmail).
  await sendInspectionOfficeEmail(inspectionId);

  return NextResponse.json({ ok: true });
}
