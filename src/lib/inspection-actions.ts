import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { createInspectionToken } from '@/lib/inspection-link';
import { sendTemplateEmail } from '@/lib/email-delivery';
import { INSPECTION_BUCKET, inspectionVideoPath } from '@/lib/inspection-storage';

/**
 * Inspection business logic, shared by the admin routes
 * (src/app/api/admin/inspections/*, used by Daniel logged in as admin) and
 * the driver routes (src/app/api/driver/inspections/*, used by drivers
 * logged in with their own PIN). Auth is deliberately NOT handled here —
 * each caller checks its own cookie (admin_auth vs driver_auth) before
 * calling in, so this file has no notion of who's allowed to call it.
 */

const LOGO_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png';
const ALLOWED_EXT = new Set(['mp4', 'mov', 'webm']);

export type ActionResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export interface CreateInspectionParams {
  bookingId: string;
  type: 'pickup' | 'return';
  odometerKm: number;
  fuelEighths: number;
  videoExt: string;
  driverId?: string | null;
}

export interface CreateInspectionResult {
  inspectionId: string;
  bucket: string;
  path: string;
  uploadEndpoint: string;
  expiresAt: string;
}

/**
 * Starts a pickup/return inspection: creates the row and pre-authorises
 * exactly one direct-to-storage video upload (see
 * database/migrations/add-vehicle-inspections-table.sql for the storage RLS
 * policy this backs). The browser then uploads the video itself via TUS —
 * it never passes through this (or any) Vercel function, which caps
 * request bodies at 4.5MB.
 */
export async function createInspectionRecord(
  params: CreateInspectionParams
): Promise<ActionResult<CreateInspectionResult>> {
  const { bookingId, type, odometerKm, fuelEighths, driverId } = params;
  const videoExt = params.videoExt.toLowerCase();

  if (!bookingId || (type !== 'pickup' && type !== 'return')) {
    return { ok: false, status: 400, error: 'bookingId and type are required' };
  }
  if (!Number.isFinite(odometerKm) || odometerKm < 0) {
    return { ok: false, status: 400, error: 'Invalid odometer reading' };
  }
  if (![0, 2, 4, 6, 8].includes(fuelEighths)) {
    return { ok: false, status: 400, error: 'Invalid fuel level' };
  }
  if (!ALLOWED_EXT.has(videoExt)) {
    return { ok: false, status: 400, error: 'Unsupported video type' };
  }

  const supabase = createAdminClient();

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingError) {
    console.error('[inspection-actions] booking lookup failed:', bookingError.message);
    return { ok: false, status: 500, error: 'Lookup failed' };
  }
  if (!booking) {
    return { ok: false, status: 404, error: 'Booking not found' };
  }

  const { data: inspection, error: insertError } = await supabase
    .from('vehicle_inspections')
    .insert({
      booking_id: bookingId,
      type,
      odometer_km: Math.round(odometerKm),
      fuel_eighths: fuelEighths,
      driver_id: driverId ?? null,
    })
    .select('id')
    .single();
  if (insertError || !inspection) {
    console.error('[inspection-actions] insert failed:', insertError?.message);
    return { ok: false, status: 500, error: 'Failed to create inspection' };
  }

  const path = inspectionVideoPath(inspection.id, videoExt);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { error: slotError } = await supabase
    .from('inspection_upload_slots')
    .insert({ path, inspection_id: inspection.id, expires_at: expiresAt });
  if (slotError) {
    console.error('[inspection-actions] upload slot creation failed:', slotError.message);
    return { ok: false, status: 500, error: 'Failed to authorise upload' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('[inspection-actions] NEXT_PUBLIC_SUPABASE_URL is not set');
    return { ok: false, status: 500, error: 'Server misconfigured' };
  }

  return {
    ok: true,
    data: {
      inspectionId: inspection.id,
      bucket: INSPECTION_BUCKET,
      path,
      uploadEndpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      expiresAt,
    },
  };
}

export interface CompleteInspectionResult {
  signLinkSent: boolean;
  signLink: string;
}

/**
 * Called once the browser's TUS upload has finished. Hashes the uploaded
 * video server-side (never trusting a client-computed hash), releases the
 * upload slot, and sends the "please sign" email.
 */
export async function completeInspectionUpload(inspectionId: string): Promise<ActionResult<CompleteInspectionResult>> {
  const supabase = createAdminClient();

  const { data: inspection, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, type, video_path, video_sha256, booking:bookings(id, customer_name, customer_email, vehicle:vehicles(make, model))'
    )
    .eq('id', inspectionId)
    .maybeSingle();

  if (error) {
    console.error('[inspection-actions] complete lookup failed:', error.message);
    return { ok: false, status: 500, error: 'Lookup failed' };
  }
  if (!inspection) {
    return { ok: false, status: 404, error: 'Inspection not found' };
  }
  if (!inspection.video_path) {
    return { ok: false, status: 400, error: 'No video path on this inspection' };
  }

  // Idempotent: a retried "complete" call (e.g. a flaky connection right
  // after the upload) just re-sends the same result rather than re-hashing
  // or re-emailing.
  if (!inspection.video_sha256) {
    const { data: file, error: downloadError } = await supabase.storage
      .from(INSPECTION_BUCKET)
      .download(inspection.video_path);
    if (downloadError || !file) {
      console.error('[inspection-actions] video not found in storage:', downloadError?.message);
      return { ok: false, status: 409, error: 'Uploaded video not found — try again' };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const { error: updateError } = await supabase
      .from('vehicle_inspections')
      .update({ video_sha256: sha256 })
      .eq('id', inspectionId);
    if (updateError) {
      console.error('[inspection-actions] hash update failed:', updateError.message);
      return { ok: false, status: 500, error: 'Failed to record video hash' };
    }

    await supabase.from('inspection_upload_slots').delete().eq('inspection_id', inspectionId);
  }

  const key = `vehicle_inspection_sign:${inspectionId}`;
  const token = createInspectionToken(inspectionId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';
  const signLink = `${baseUrl}/he/inspection-sign?token=${encodeURIComponent(token)}`;

  const booking = inspection.booking as unknown as {
    customer_name: string;
    customer_email: string;
    vehicle: { make: string; model: string } | null;
  } | null;

  let signLinkSent = false;
  if (booking?.customer_email) {
    const result = await sendTemplateEmail({
      event: 'vehicle_inspection_sign',
      idempotencyKey: key,
      templateId: process.env.NEXT_PUBLIC_EMAILJS_INSPECTION_SIGN_TEMPLATE_ID,
      params: {
        to_email: booking.customer_email,
        to_name: booking.customer_name,
        vehicle_name: `${booking.vehicle?.make ?? ''} ${booking.vehicle?.model ?? ''}`.trim(),
        inspection_type: inspection.type === 'pickup' ? 'קבלת הרכב' : 'החזרת הרכב',
        sign_link: signLink,
        logo_url: LOGO_URL,
      },
    });
    signLinkSent = result.ok;
  }

  return { ok: true, data: { signLinkSent, signLink } };
}

/** Status view for the "is it signed yet" screen (admin and driver both use this shape). */
export async function getInspectionStatus(inspectionId: string): Promise<ActionResult<unknown>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, booking_id, type, odometer_km, fuel_eighths, status, signed_at, video_sha256, booking:bookings(id, customer_name, customer_email, vehicle:vehicles(make, model, license_plate))'
    )
    .eq('id', inspectionId)
    .maybeSingle();

  if (error) {
    console.error('[inspection-actions] status lookup failed:', error.message);
    return { ok: false, status: 500, error: 'Lookup failed' };
  }
  if (!data) {
    return { ok: false, status: 404, error: 'Inspection not found' };
  }

  return { ok: true, data };
}
