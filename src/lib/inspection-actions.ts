import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { createInspectionToken } from '@/lib/inspection-link';
import { sendTemplateEmail } from '@/lib/email-delivery';
import { INSPECTION_BUCKET, inspectionVideoPath } from '@/lib/inspection-storage';
import { bookingVehicleName } from '@/lib/booking-vehicle';
import { sendInspectionCustomerEmail } from '@/lib/inspection-customer-email';
import {
  evidenceError,
  markPhotoPath,
  parseDamageMarks,
  parseSidePhotoViews,
  sidePhotoPath,
  type DamageMark,
} from '@/lib/inspection-damage';
import { parseChecklist } from '@/lib/inspection-checklist';

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
  /** Video is optional when damage is marked on the diagram (or "no damage" + 4 side photos). */
  hasVideo?: boolean;
  videoExt: string;
  damageMarks?: unknown;
  noDamage?: boolean;
  sidePhotoViews?: unknown;
  /** Optional condition checklist ({ item: 'ok' | 'bad' }). */
  checklist?: unknown;
  /** Return only: the handover inspection it's compared with (picked by the driver). */
  handoverInspectionId?: string | null;
  driverId?: string | null;
}

export interface PhotoUpload {
  /** "mark-3" / "side-front" — matches the client's pending photo list. */
  key: string;
  path: string;
  token: string;
}

export interface CreateInspectionResult {
  inspectionId: string;
  bucket: string;
  /** Present only when a video is being uploaded. */
  video: {
    path: string;
    uploadEndpoint: string;
    /** Signed upload token (sent as the TUS `x-signature` header). */
    uploadToken: string;
  } | null;
  photos: PhotoUpload[];
  expiresAt: string;
}

/**
 * Starts a pickup/return inspection: validates the evidence (video, and/or
 * damage marked on the diagram, or "no damage" + 4 side photos), creates
 * the row and issues one Supabase signed upload token per file. The browser
 * uploads the files itself — never through a Vercel function, which caps
 * request bodies at 4.5MB — video via resumable TUS, photos via a plain
 * signed upload.
 */
export async function createInspectionRecord(
  params: CreateInspectionParams
): Promise<ActionResult<CreateInspectionResult>> {
  const { bookingId, type, odometerKm, fuelEighths, driverId } = params;
  const hasVideo = params.hasVideo !== false;
  const videoExt = String(params.videoExt ?? 'mp4').toLowerCase();
  const noDamage = params.noDamage === true;

  if (!bookingId || (type !== 'pickup' && type !== 'return')) {
    return { ok: false, status: 400, error: 'bookingId and type are required' };
  }
  if (!Number.isFinite(odometerKm) || odometerKm < 0) {
    return { ok: false, status: 400, error: 'Invalid odometer reading' };
  }
  if (!Number.isInteger(fuelEighths) || fuelEighths < 0 || fuelEighths > 8) {
    return { ok: false, status: 400, error: 'Invalid fuel level' };
  }
  if (hasVideo && !ALLOWED_EXT.has(videoExt)) {
    return { ok: false, status: 400, error: 'Unsupported video type' };
  }
  const marks = parseDamageMarks(params.damageMarks);
  if (!marks) return { ok: false, status: 400, error: 'Invalid damage marks' };
  const sideViews = parseSidePhotoViews(params.sidePhotoViews);
  if (!sideViews) return { ok: false, status: 400, error: 'Invalid side photos' };
  const evidence = evidenceError({ hasVideo, markCount: marks.length, noDamage, sidePhotoViews: sideViews });
  if (evidence) return { ok: false, status: 400, error: evidence };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('[inspection-actions] NEXT_PUBLIC_SUPABASE_URL is not set');
    return { ok: false, status: 500, error: 'Server misconfigured' };
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

  // Record where every file will live *before* the uploads start —
  // complete, the sign page, the PDF and the office email all read these.
  const videoPath = hasVideo ? inspectionVideoPath(inspection.id, videoExt) : null;
  const storedMarks: DamageMark[] = marks.map((m) => ({
    n: m.n,
    view: m.view,
    x: m.x,
    y: m.y,
    kind: m.kind,
    note: m.note,
    photo_path: m.hasPhoto ? markPhotoPath(inspection.id, m.n) : null,
  }));
  const sidePhotos: Record<string, string> = {};
  for (const v of sideViews) sidePhotos[v] = sidePhotoPath(inspection.id, v);

  const { error: pathError } = await supabase
    .from('vehicle_inspections')
    .update({
      video_path: videoPath,
      damage_marks: storedMarks,
      no_damage: noDamage && marks.length === 0,
      side_photos: sidePhotos,
      checklist: parseChecklist(params.checklist),
    })
    .eq('id', inspection.id);

  if (type === 'return' && params.handoverInspectionId) {
    // Best-effort: only link a real handover; never fails the inspection.
    const { data: handover } = await supabase
      .from('vehicle_inspections')
      .select('id')
      .eq('id', String(params.handoverInspectionId))
      .eq('type', 'pickup')
      .maybeSingle();
    if (handover) {
      const { error: linkError } = await supabase
        .from('vehicle_inspections')
        .update({ handover_inspection_id: handover.id })
        .eq('id', inspection.id);
      if (linkError) console.error('[inspection-actions] handover link failed:', linkError.message);
    }
  }
  if (pathError) {
    console.error('[inspection-actions] media paths update failed:', pathError.message);
    return { ok: false, status: 500, error: 'Failed to prepare upload' };
  }

  const bucket = supabase.storage.from(INSPECTION_BUCKET);
  // Signed upload tokens are scoped to one object path and verified by
  // Storage itself, so uploads don't depend on anon-role RLS policies.
  const sign = async (path: string) => {
    const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: true });
    if (error || !data?.token) throw new Error(error?.message ?? 'no token');
    return data.token;
  };

  let video: CreateInspectionResult['video'] = null;
  const photos: PhotoUpload[] = [];
  try {
    if (videoPath) {
      video = {
        path: videoPath,
        uploadEndpoint: `${supabaseUrl}/storage/v1/upload/resumable/sign`,
        uploadToken: await sign(videoPath),
      };
    }
    const photoTargets = [
      ...storedMarks.filter((m) => m.photo_path).map((m) => ({ key: `mark-${m.n}`, path: m.photo_path as string })),
      ...Object.entries(sidePhotos).map(([view, path]) => ({ key: `side-${view}`, path })),
    ];
    const tokens = await Promise.all(photoTargets.map((t) => sign(t.path)));
    photoTargets.forEach((t, i) => photos.push({ ...t, token: tokens[i] }));
  } catch (err) {
    console.error('[inspection-actions] signed upload url failed:', (err as Error).message);
    return { ok: false, status: 500, error: 'Failed to authorise upload' };
  }

  // Signed upload tokens are valid for 2 hours on Supabase's side.
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  return {
    ok: true,
    data: { inspectionId: inspection.id, bucket: INSPECTION_BUCKET, video, photos, expiresAt },
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
      'id, type, video_path, video_sha256, damage_marks, side_photos, media_completed_at, booking:bookings(id, customer_name, customer_email, custom_vehicle_name, vehicle:vehicles(make, model, license_plate))'
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

  // Idempotent: a retried "complete" call (e.g. a flaky connection right
  // after the upload) just re-sends the same result rather than re-hashing
  // or re-emailing.
  if (!inspection.media_completed_at) {
    const bucket = supabase.storage.from(INSPECTION_BUCKET);

    // Every photo the driver said he'd upload must actually be there.
    const marks = (inspection.damage_marks ?? []) as DamageMark[];
    const sides = (inspection.side_photos ?? {}) as Record<string, string>;
    const expectedPhotos = [
      ...marks.map((m) => m.photo_path).filter((p): p is string => Boolean(p)),
      ...Object.values(sides),
    ];
    if (expectedPhotos.length) {
      const folders = Array.from(new Set(expectedPhotos.map((p) => p.slice(0, p.lastIndexOf('/')))));
      const present = new Set<string>();
      for (const folder of folders) {
        const { data: files, error: listError } = await bucket.list(folder, { limit: 100 });
        if (listError) {
          console.error('[inspection-actions] photo list failed:', listError.message);
          return { ok: false, status: 500, error: 'Failed to verify photos' };
        }
        for (const f of files ?? []) present.add(`${folder}/${f.name}`);
      }
      const missing = expectedPhotos.filter((p) => !present.has(p));
      if (missing.length) {
        console.error('[inspection-actions] photos missing for %s: %s', inspectionId, missing.join(', '));
        return { ok: false, status: 409, error: 'Uploaded photos not found — try again' };
      }
    }

    if (inspection.video_path && !inspection.video_sha256) {
      const { data: file, error: downloadError } = await bucket.download(inspection.video_path);
      if (downloadError || !file) {
        console.error('[inspection-actions] video not found in storage:', downloadError?.message);
        return { ok: false, status: 409, error: 'Uploaded video not found — try again' };
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      const { error: hashError } = await supabase
        .from('vehicle_inspections')
        .update({ video_sha256: sha256 })
        .eq('id', inspectionId);
      if (hashError) {
        console.error('[inspection-actions] hash update failed:', hashError.message);
        return { ok: false, status: 500, error: 'Failed to record video hash' };
      }
    }

    const { error: doneError } = await supabase
      .from('vehicle_inspections')
      .update({ media_completed_at: new Date().toISOString() })
      .eq('id', inspectionId);
    if (doneError) {
      console.error('[inspection-actions] media_completed_at update failed:', doneError.message);
      return { ok: false, status: 500, error: 'Failed to finish inspection' };
    }

    await supabase.from('inspection_upload_slots').delete().eq('inspection_id', inspectionId);
  }

  // The customer now reviews and signs in person on the driver's phone
  // (/driver/inspection/[id]/sign). The emailed link is only sent on demand
  // (sendInspectionSignLink) when the customer isn't there.
  const token = createInspectionToken(inspectionId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';
  const signLink = `${baseUrl}/he/inspection-sign?token=${encodeURIComponent(token)}`;
  return { ok: true, data: { signLinkSent: false, signLink } };
}

/**
 * Remote-signing fallback: emails the customer a link to review and sign
 * (for when they're not with the driver, e.g. a key-drop return).
 */
export async function sendInspectionSignLink(inspectionId: string): Promise<ActionResult<CompleteInspectionResult>> {
  const supabase = createAdminClient();
  const { data: inspection, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, type, status, video_path, damage_marks, media_completed_at, video_sha256, booking:bookings(id, customer_name, customer_email, custom_vehicle_name, vehicle:vehicles(make, model, license_plate))'
    )
    .eq('id', inspectionId)
    .maybeSingle();
  if (error) {
    console.error('[inspection-actions] sign-link lookup failed:', error.message);
    return { ok: false, status: 500, error: 'Lookup failed' };
  }
  if (!inspection) return { ok: false, status: 404, error: 'Inspection not found' };
  if (!inspection.media_completed_at && !inspection.video_sha256) {
    return { ok: false, status: 409, error: 'Inspection upload not finished' };
  }
  if (inspection.status === 'signed') return { ok: false, status: 409, error: 'הבדיקה כבר נחתמה' };

  const key = `vehicle_inspection_sign:${inspectionId}`;
  const token = createInspectionToken(inspectionId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';
  const signLink = `${baseUrl}/he/inspection-sign?token=${encodeURIComponent(token)}`;

  const booking = inspection.booking as unknown as {
    customer_name: string;
    customer_email: string;
    custom_vehicle_name: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;

  const videoLink = `${baseUrl}/insp-video/${encodeURIComponent(token)}`;
  const typeLabel = inspection.type === 'pickup' ? 'מסירת הרכב' : 'החזרת הרכב';
  const vehicleName = booking ? bookingVehicleName(booking) : '';

  let signLinkSent = false;
  if (booking?.customer_email) {
    // Primary: Resend (verified office sender). Fallback: the EmailJS
    // outbox, which also queues retries if it fails.
    const direct = await sendInspectionCustomerEmail({
      inspectionId,
      toEmail: booking.customer_email,
      customerName: booking.customer_name,
      vehicleName,
      typeLabel,
      signLink,
      videoLink: inspection.video_path ? videoLink : null,
      damageCount: ((inspection.damage_marks ?? []) as DamageMark[]).length,
      logoUrl: LOGO_URL,
    });
    signLinkSent = direct.ok;

    if (!signLinkSent) {
      const result = await sendTemplateEmail({
        event: 'vehicle_inspection_sign',
        idempotencyKey: key,
        templateId: process.env.NEXT_PUBLIC_EMAILJS_INSPECTION_SIGN_TEMPLATE_ID,
        params: {
          to_email: booking.customer_email,
          to_name: booking.customer_name,
          vehicle_name: vehicleName,
          inspection_type: typeLabel,
          sign_link: signLink,
          video_link: inspection.video_path ? videoLink : '',
          logo_url: LOGO_URL,
        },
      });
      signLinkSent = result.ok;
    }
  }

  return { ok: true, data: { signLinkSent, signLink } };
}

/** Status view for the "is it signed yet" screen (admin and driver both use this shape). */
export async function getInspectionStatus(inspectionId: string): Promise<ActionResult<unknown>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, booking_id, type, odometer_km, fuel_eighths, status, signed_at, video_sha256, booking:bookings(id, customer_name, customer_email, custom_vehicle_name, vehicle:vehicles(make, model, license_plate))'
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
