import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server';
import { OFFICE_EMAIL } from '@/lib/constants';
import { numericOrderReference } from '@/lib/order-reference';
import { fuelEighthsToLabel, INSPECTION_BUCKET } from '@/lib/inspection-storage';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import { calculateInspectionDeviation } from '@/lib/inspection-deviation';
import { createInspectionToken } from '@/lib/inspection-link';
import { damageKindLabel, VIEW_LABELS, type DamageMark } from '@/lib/inspection-damage';

/**
 * Internal "customer signed" notification to the office — separate from
 * the customer-facing emails (those go through the EmailJS outbox in
 * email-delivery.ts and must never carry an office bcc, so the two are
 * kept fully independent rather than sharing a code path).
 *
 * Sent via Resend, same as src/app/api/cron/phone-export, because this one
 * needs a real file attachment (the signed PDF) — EmailJS templates can't
 * carry one. The admin link points at the always-logged-in-gated
 * /admin/inspections/[id] page, not the customer's 30-day signing token,
 * so office access to the video never expires.
 */

const MAX_ATTEMPTS = 5;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function loadInspectionForOfficeEmail(inspectionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, type, odometer_km, fuel_eighths, signed_at, video_sha256, video_path, damage_marks, no_damage, side_photos, signed_pdf_path, booking:bookings(id, customer_name, total_days, custom_vehicle_name, vehicle:vehicles(make, model, license_plate)), driver:drivers(name)'
    )
    .eq('id', inspectionId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as {
    id: string;
    type: 'pickup' | 'return';
    odometer_km: number;
    fuel_eighths: number;
    signed_at: string | null;
    video_sha256: string | null;
    video_path: string | null;
    damage_marks: DamageMark[] | null;
    no_damage: boolean | null;
    side_photos: Record<string, string> | null;
    signed_pdf_path: string | null;
    booking: {
      id: string;
      customer_name: string;
      total_days: number | null;
      custom_vehicle_name: string | null;
      vehicle: { make: string; model: string; license_plate: string | null } | null;
    } | null;
    driver: { name: string } | null;
  };
}

async function recordFailure(inspectionId: string, errorMessage: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('inspection_office_outbox')
    .select('attempts')
    .eq('inspection_id', inspectionId)
    .maybeSingle();
  const attempts = Number(data?.attempts ?? 0) + 1;

  const { error } = await supabase.from('inspection_office_outbox').upsert(
    {
      inspection_id: inspectionId,
      status: 'pending',
      attempts,
      last_error: errorMessage.slice(0, 500),
      // Cron runs once a day, so leave the row due for the next sweep
      // regardless of what time this attempt failed.
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'inspection_id' }
  );
  if (error) {
    console.error('[inspection-office-email][ALERT] could not queue retry for %s: %s', inspectionId, error.message);
  }
}

async function resolve(inspectionId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('inspection_office_outbox').delete().eq('inspection_id', inspectionId);
  if (error) {
    console.error('[inspection-office-email][ALERT] could not clear retry row for %s: %s', inspectionId, error.message);
  }
}

/**
 * Sends the office notification for a signed inspection. Idempotent via
 * Resend's own idempotencyKey (a retried send for the same inspection
 * cannot produce a second email at Resend's end). Always sends — even
 * when the PDF failed to generate/upload, in which case the email says so
 * plainly rather than silently going out without it.
 */
export async function sendInspectionOfficeEmail(inspectionId: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = 'Resend is not configured';
    console.error('[inspection-office-email][ALERT] %s (ref %s)', error, inspectionId);
    await recordFailure(inspectionId, error);
    return { ok: false, error };
  }

  const inspection = await loadInspectionForOfficeEmail(inspectionId);
  if (!inspection) {
    const error = 'Inspection not found';
    console.error('[inspection-office-email][ALERT] %s (ref %s)', error, inspectionId);
    await recordFailure(inspectionId, error);
    return { ok: false, error };
  }

  const supabase = createAdminClient();
  let pdfBuffer: Buffer | null = null;
  if (inspection.signed_pdf_path) {
    const { data: pdfFile, error: downloadError } = await supabase.storage
      .from(INSPECTION_BUCKET)
      .download(inspection.signed_pdf_path);
    if (downloadError || !pdfFile) {
      console.error('[inspection-office-email] PDF download failed for %s: %s', inspectionId, downloadError?.message);
    } else {
      pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    }
  }
  const pdfMissing = !pdfBuffer;

  const booking = inspection.booking;
  const bookingNumber = numericOrderReference(booking?.id ?? inspectionId);
  const typeLabel = inspection.type === 'pickup' ? 'קבלת הרכב' : 'החזרת הרכב';
  const fuelLabel = fuelEighthsToLabel(inspection.fuel_eighths);
  const signedAtIL = inspection.signed_at
    ? new Date(inspection.signed_at).toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'medium' })
    : '—';
  const vehicleName = bookingVehicleName(booking);
  const licensePlate = bookingLicensePlate(booking);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';
  const adminLink = `${baseUrl}/he/admin/inspections/${inspectionId}`;
  const videoLink = `${baseUrl}/insp-video/${encodeURIComponent(createInspectionToken(inspectionId, 24 * 365))}`;

  let deviation = calculateInspectionDeviation(
    null,
    { odometerKm: inspection.odometer_km, fuelEighths: inspection.fuel_eighths },
    booking?.total_days ?? 1
  );
  if (inspection.type === 'return' && booking?.id) {
    const { data: pickup } = await supabase
      .from('vehicle_inspections')
      .select('odometer_km, fuel_eighths')
      .eq('booking_id', booking.id)
      .eq('type', 'pickup')
      .eq('status', 'signed')
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    deviation = calculateInspectionDeviation(
      pickup
        ? { odometerKm: pickup.odometer_km, fuelEighths: pickup.fuel_eighths }
        : null,
      { odometerKm: inspection.odometer_km, fuelEighths: inspection.fuel_eighths },
      booking.total_days ?? 1
    );
  }

  const missingPdfWarning = pdfMissing
    ? '<p style="color:#b91c1c;font-weight:700;">⚠️ קובץ ה-PDF החתום חסר — יש לבדוק ידנית באמצעות הקישור למטה.</p>'
    : '';
  const deviationWarning = deviation.hasDeviation
    ? `<div style="margin:14px 0;padding:12px;border:2px solid #dc2626;background:#fef2f2;color:#991b1b;font-weight:700;">
        🚨 נמצאה חריגה בבדיקת ההחזרה:<br>${deviation.warnings.join('<br>')}
      </div>`
    : '';

  const marks = inspection.damage_marks ?? [];
  const damageHtml = marks.length
    ? `<h3 style="margin:16px 0 6px;">נזקים קיימים שסומנו (${marks.length})</h3><ol style="margin:0;padding-inline-start:20px;">${marks
        .map(
          (m) =>
            `<li>${VIEW_LABELS[m.view]?.he ?? m.view} — <strong>${damageKindLabel(m.kind)}</strong>${m.note ? `: ${m.note.replace(/[<>&]/g, '')}` : ''}${m.photo_path ? ' 📷' : ''}</li>`
        )
        .join('')}</ol><p style="font-size:12px;color:#666;">השרטוט והתמונות מופיעים ב-PDF המצורף.</p>`
    : inspection.no_damage
      ? '<p style="margin-top:12px;font-weight:700;">הנהג אישר: אין נזקים (צולמו 4 צדדים — בקובץ ה-PDF).</p>'
      : '';

  const html = `
    <div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;color:#0D2B2B;">
      <h2>בדיקת רכב נחתמה — ${typeLabel}</h2>
      ${missingPdfWarning}
      ${deviationWarning}
      <table style="border-collapse:collapse;">
        <tr><td style="padding:4px 10px;color:#666;">מספר הזמנה</td><td style="padding:4px 10px;font-weight:700;" dir="ltr">${bookingNumber}</td></tr>
        <tr><td style="padding:4px 10px;color:#666;">שם הלקוח</td><td style="padding:4px 10px;font-weight:700;">${booking?.customer_name ?? '—'}</td></tr>
        <tr><td style="padding:4px 10px;color:#666;">רכב</td><td style="padding:4px 10px;font-weight:700;">${vehicleName} — <span dir="ltr">${licensePlate}</span></td></tr>
        <tr><td style="padding:4px 10px;color:#666;">סוג בדיקה</td><td style="padding:4px 10px;font-weight:700;">${typeLabel}</td></tr>
        <tr><td style="padding:4px 10px;color:#666;">קילומטראז'</td><td style="padding:4px 10px;font-weight:700;" dir="ltr">${inspection.odometer_km.toLocaleString('he-IL')} ק"מ</td></tr>
        <tr><td style="padding:4px 10px;color:#666;">רמת דלק</td><td style="padding:4px 10px;font-weight:700;">${fuelLabel}</td></tr>
        ${inspection.type === 'return' && deviation.distanceKm !== null ? `<tr><td style="padding:4px 10px;color:#666;">נסיעה בפועל / מכסה</td><td style="padding:4px 10px;font-weight:700;" dir="ltr">${deviation.distanceKm.toLocaleString('he-IL')} / ${deviation.allowedKm.toLocaleString('he-IL')} ק"מ</td></tr>` : ''}
        <tr><td style="padding:4px 10px;color:#666;">נהג מבצע הבדיקה</td><td style="padding:4px 10px;font-weight:700;">${inspection.driver?.name ?? '—'}</td></tr>
        <tr><td style="padding:4px 10px;color:#666;">נחתם בתאריך</td><td style="padding:4px 10px;font-weight:700;">${signedAtIL}</td></tr>
        <tr><td style="padding:4px 10px;color:#666;">SHA-256 של הסרטון</td><td style="padding:4px 10px;font-size:11px;direction:ltr;text-align:left;word-break:break-all;">${inspection.video_sha256 ?? '—'}</td></tr>
      </table>
      ${damageHtml}
      ${inspection.video_path ? `<p style="margin-top:16px;"><a href="${videoLink}" style="display:inline-block;background:#2D5F5F;color:#fff;text-decoration:none;font-weight:700;padding:10px 20px;border-radius:8px;">▶ צפייה בסרטון הבדיקה</a></p>` : '<p style="margin-top:16px;color:#666;">ללא סרטון — תועד בשרטוט נזקים / תמונות.</p>'}
      <p style="margin-top:8px;">המסמך החתום מצורף כ-PDF. <a href="${adminLink}" style="color:#2D5F5F;font-weight:700;">פרטי הבדיקה במסך הניהול</a></p>
    </div>
  `;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(
    {
      from: `SmartCar <${OFFICE_EMAIL}>`,
      to: OFFICE_EMAIL,
      subject: `${deviation.hasDeviation ? '🚨 חריגה — ' : pdfMissing ? '⚠️ ' : ''}בדיקת רכב נחתמה — ${typeLabel} #${bookingNumber}`,
      html,
      text: `בדיקת רכב נחתמה. הזמנה ${bookingNumber}, ${booking?.customer_name ?? ''}.${deviation.hasDeviation ? ` חריגה: ${deviation.warnings.join('; ')}.` : ''} ${inspection.video_path ? `סרטון: ${videoLink} | ` : ''}${marks.length ? `נזקים שסומנו: ${marks.length} | ` : ''}ניהול: ${adminLink}`,
      attachments: pdfBuffer
        ? [{ content: pdfBuffer, filename: `SmartCar_Inspection_${bookingNumber}.pdf`, contentType: 'application/pdf' }]
        : [],
      tags: [{ name: 'category', value: 'vehicle-inspection-office' }],
    },
    { idempotencyKey: `vehicle-inspection-office-${inspectionId}` }
  );

  if (error) {
    const message = `${error.name}: ${error.message}`;
    console.error('[inspection-office-email][ALERT] send failed for %s: %s', inspectionId, message);
    await recordFailure(inspectionId, message);
    return { ok: false, error: message };
  }

  await resolve(inspectionId);
  return { ok: true };
}

interface PendingOfficeRow {
  inspection_id: string;
  attempts: number;
  created_at: string;
}

/** Swept by the daily email-retry cron alongside the EmailJS outbox. */
export async function retryPendingInspectionOfficeEmails(
  limit = 20
): Promise<{ swept: number; delivered: number; dead: number; pending: number }> {
  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from('inspection_office_outbox')
    .select('inspection_id, attempts, created_at')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[inspection-office-email][cron] could not read retry queue:', error.message);
    return { swept: 0, delivered: 0, dead: 0, pending: 0 };
  }

  let delivered = 0;
  let dead = 0;
  let stillPending = 0;

  for (const row of (rows ?? []) as PendingOfficeRow[]) {
    const result = await sendInspectionOfficeEmail(row.inspection_id);
    if (result.ok) {
      delivered++;
      continue;
    }

    // sendInspectionOfficeEmail's own recordFailure already incremented
    // attempts for this call — +1 here reflects that without a second read.
    const attemptsSoFar = row.attempts + 1;
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    if (attemptsSoFar >= MAX_ATTEMPTS || ageMs >= MAX_AGE_MS) {
      dead++;
      console.error(
        '[inspection-office-email][ALERT] permanently undelivered after %s attempt(s) (ref %s)',
        attemptsSoFar,
        row.inspection_id
      );
      const { error: deadUpdateError } = await supabase
        .from('inspection_office_outbox')
        .update({ status: 'dead', updated_at: new Date().toISOString() })
        .eq('inspection_id', row.inspection_id);
      if (deadUpdateError) {
        console.error(
          '[inspection-office-email][ALERT] could not mark %s dead: %s',
          row.inspection_id,
          deadUpdateError.message
        );
      }
      continue;
    }

    stillPending++;
  }

  return { swept: rows?.length ?? 0, delivered, dead, pending: stillPending };
}
