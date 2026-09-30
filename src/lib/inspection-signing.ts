import { createAdminClient } from '@/lib/supabase/server';
import { createInspectionToken } from '@/lib/inspection-link';
import { loadHandoverDamage } from '@/lib/inspection-previous';
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
import { sendInspectionSignedCustomerEmail } from '@/lib/inspection-customer-email';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import type { DamageMark } from '@/lib/inspection-damage';
import { checklistEntries, type Checklist } from '@/lib/inspection-checklist';


/**
 * Shared inspection e-signing: the data the review/sign screen shows, and
 * recording a signature (status → signed, then PDF + customer copy + office
 * email). Used by the customer's link route (/api/inspections/sign, token +
 * Turnstile) and the in-person route on the driver's phone
 * (/api/driver/inspections/[id]/sign, driver login).
 */

const LOGO_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png';

type InspectionRow = {
  id: string;
  type: 'pickup' | 'return';
  odometer_km: number;
  fuel_eighths: number;
  status: 'awaiting_signature' | 'signed';
  signed_at: string | null;
  video_sha256: string | null;
  video_path: string | null;
  damage_marks: DamageMark[] | null;
  no_damage: boolean | null;
  side_photos: Record<string, string> | null;
  media_completed_at: string | null;
  checklist: Checklist | null;
  booking: {
    id: string;
    customer_name: string;
    customer_email: string;
    custom_vehicle_name: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
  driver: { name: string } | null;
};

const VIEW_SELECT =
  'id, type, odometer_km, fuel_eighths, status, signed_at, video_sha256, video_path, damage_marks, no_damage, side_photos, media_completed_at, checklist, booking:bookings(id, customer_name, customer_email, customer_phone, custom_vehicle_name, vehicle:vehicles(make, model, license_plate))';

export type SignResult = { ok: true } | { ok: false; status: number; error: string };

/** What the review/sign screen needs. mediaToken gates /insp-video and /insp-photo. */
export async function loadSignView(
  inspectionId: string,
  mediaToken: string
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(VIEW_SELECT)
    .eq('id', inspectionId)
    .maybeSingle<InspectionRow>();
  if (error) {
    console.error('[inspection-signing] view lookup failed:', error.message);
    return { ok: false, status: 500, error: 'lookup_failed' };
  }
  if (!data) return { ok: false, status: 404, error: 'not_found' };
  const handover = data.type === 'return' && data.booking?.id ? await loadHandoverDamage(data.booking.id) : null;
  return {
    ok: true,
    data: {
      handoverMarks: (handover?.marks ?? []).map((m) => ({
        n: m.n,
        view: m.view,
        x: m.x,
        y: m.y,
        kind: m.kind,
        note: m.note,
        hasPhoto: Boolean(m.photo_path),
      })),
      handoverMediaToken: handover?.mediaToken ?? '',
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
      hasVideo: Boolean(data.video_path),
      mediaReady: Boolean(data.media_completed_at || data.video_sha256),
      damageMarks: (data.damage_marks ?? []).map((m) => ({
        n: m.n,
        view: m.view,
        x: m.x,
        y: m.y,
        kind: m.kind,
        note: m.note,
        hasPhoto: Boolean(m.photo_path),
      })),
      noDamage: Boolean(data.no_damage),
      sidePhotoViews: Object.keys(data.side_photos ?? {}),
      checklist: checklistEntries(data.checklist),
      customerEmail: data.booking?.customer_email ?? '',
      customerPhone: (data.booking as { customer_phone?: string | null } | null)?.customer_phone ?? '',
      // 30-day link to the signed PDF, for sending the customer a copy on WhatsApp.
      signedPdfUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il'}/insp-pdf/${encodeURIComponent(createInspectionToken(data.id))}`,
      mediaToken,
    },
  };
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function finalizeSignedInspection(args: {
  supabase: SupabaseAdmin;
  inspection: InspectionRow & { signed_at: string };
  inspectionId: string;
  signatureDataUrl: string;
  signatureBase64: string;
  signerIp: string;
  token: string;
}): Promise<void> {
  const { supabase, inspection, inspectionId, signatureDataUrl, signatureBase64, signerIp, token } = args;
  const booking = inspection.booking;

  // Flips the matching driver task (if any) to 'done'.
  try {
    if (booking?.id) {
      const { error: taskUpdateError } = await supabase
        .from('driver_tasks')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('booking_id', booking.id)
        .eq('type', inspection.type)
        .eq('status', 'open');
      if (taskUpdateError) {
        console.error('[inspections/sign][POST] task status update failed:', taskUpdateError.message);
      }
    }
  } catch (err) {
    console.error('[inspections/sign][POST] task status update threw:', err);
  }

  try {
    const { error: sigUploadError } = await supabase.storage
      .from(INSPECTION_BUCKET)
      .upload(inspectionSignaturePath(inspectionId), Buffer.from(signatureBase64, 'base64'), { contentType: 'image/png', upsert: true });
    if (sigUploadError) {
      console.error('[inspections/sign][POST] signature upload failed:', sigUploadError.message);
    }
  } catch (err) {
    console.error('[inspections/sign][POST] signature upload threw:', err);
  }

  const bookingNumber = numericOrderReference(booking?.id ?? inspectionId);

  let pdfBuffer: Buffer | null = null;

  // PDF: any failure (Chromium, photo URLs, upload) leaves the office email
  // to go out without it — sendInspectionOfficeEmail flags a missing PDF.
  try {
    // Short-lived signed URLs so headless Chromium can embed the damage and
    // side photos in the PDF (the bucket itself stays private).
    const marks = inspection.damage_marks ?? [];
    const photoUrlFor = async (path: string | null | undefined): Promise<string | null> => {
      if (!path) return null;
      const { data: signedUrl } = await supabase.storage.from(INSPECTION_BUCKET).createSignedUrl(path, 10 * 60);
      return signedUrl?.signedUrl ?? null;
    };
    const damageRows = await Promise.all(
      marks.map(async (m) => ({ ...m, photoUrl: await photoUrlFor(m.photo_path) }))
    );
    const sidePhotoRows = await Promise.all(
      Object.entries(inspection.side_photos ?? {}).map(async ([view, path]) => ({ view, photoUrl: await photoUrlFor(path) }))
    );

    pdfBuffer = await renderInspectionPdf({
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
      hasVideo: Boolean(inspection.video_path),
      damageMarks: damageRows,
      noDamage: Boolean(inspection.no_damage),
      sidePhotos: sidePhotoRows,
      checklist: checklistEntries(inspection.checklist),
      handoverMarks:
        inspection.type === 'return' && booking?.id ? (await loadHandoverDamage(booking.id))?.marks ?? [] : [],
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
  } catch (err) {
    console.error('[inspections/sign][POST] PDF generation failed — continuing without it:', err);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';
  const pdfLink = `${baseUrl}/insp-pdf/${encodeURIComponent(token)}`;
  const typeLabel = inspection.type === 'pickup' ? 'מסירת הרכב' : 'החזרת הרכב';

  // Customer copy: Resend with the signed PDF attached; EmailJS template
  // is only the fallback if Resend fails.
  try {
    if (booking?.customer_email) {
      const sent = await sendInspectionSignedCustomerEmail({
        inspectionId,
        toEmail: booking.customer_email,
        customerName: booking.customer_name,
        vehicleName: bookingVehicleName(booking),
        typeLabel,
        pdfBuffer,
        pdfLink,
        videoLink: inspection.video_path ? `${baseUrl}/insp-video/${encodeURIComponent(token)}` : null,
        logoUrl: LOGO_URL,
      });
      if (!sent.ok) {
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
    }
  } catch (err) {
    console.error('[inspections/sign][POST] customer email failed:', err);
  }

  // Internal notification to the office — independent of the customer email;
  // failures are queued in inspection_office_outbox for the daily cron sweep.
  try {
    await sendInspectionOfficeEmail(inspectionId);
  } catch (err) {
    console.error('[inspections/sign][POST] office email threw:', err);
  }
}


/**
 * Records the customer's signature. Atomic, status-guarded transition — a
 * second attempt updates zero rows (409). Once signed, nothing may fail the
 * response: the PDF and emails are best-effort (office email is retried by
 * the outbox if it fails).
 */
export async function signInspection(params: {
  inspectionId: string;
  signatureDataUrl: string;
  declarationAccepted: boolean;
  signerIp: string;
  signerUserAgent: string;
}): Promise<SignResult> {
  const { inspectionId, signerIp, signerUserAgent } = params;
  const signatureDataUrl = String(params.signatureDataUrl ?? '');
  const match = signatureDataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return { ok: false, status: 400, error: 'חתימה חסרה או לא תקינה.' };
  if (!params.declarationAccepted) return { ok: false, status: 400, error: 'יש לאשר את ההצהרה לפני החתימה.' };

  const supabase = createAdminClient();
  const { data: signedRows, error: signError } = await supabase
    .from('vehicle_inspections')
    .update({ status: 'signed', signed_at: new Date().toISOString(), signer_ip: signerIp, signer_user_agent: signerUserAgent })
    .eq('id', inspectionId)
    .eq('status', 'awaiting_signature')
    .select(
      'id, type, odometer_km, fuel_eighths, video_sha256, video_path, damage_marks, no_damage, side_photos, checklist, signed_at, booking:bookings(id, customer_name, customer_email, custom_vehicle_name, vehicle:vehicles(make, model, license_plate)), driver:drivers(name)'
    )
    .returns<InspectionRow[]>();

  if (signError) {
    console.error('[inspection-signing] update failed:', signError.message);
    return { ok: false, status: 500, error: 'שמירת החתימה נכשלה. נסה שוב.' };
  }
  if (!signedRows || signedRows.length === 0) {
    const { data: existing } = await supabase
      .from('vehicle_inspections')
      .select('signed_at')
      .eq('id', inspectionId)
      .maybeSingle();
    return {
      ok: false,
      status: 409,
      error: existing?.signed_at
        ? `הבדיקה כבר נחתמה בתאריך ${new Date(existing.signed_at).toLocaleString('he-IL')}.`
        : 'הבדיקה לא נמצאה.',
    };
  }

  const inspection = signedRows[0] as unknown as InspectionRow & { signed_at: string };
  try {
    await finalizeSignedInspection({
      supabase,
      inspection,
      inspectionId,
      signatureDataUrl,
      signatureBase64: match[1],
      signerIp,
      token: createInspectionToken(inspectionId),
    });
  } catch (err) {
    console.error('[inspection-signing] post-sign processing failed:', err);
    await sendInspectionOfficeEmail(inspectionId).catch((e) =>
      console.error('[inspection-signing] fallback office email failed:', e)
    );
  }
  return { ok: true };
}
