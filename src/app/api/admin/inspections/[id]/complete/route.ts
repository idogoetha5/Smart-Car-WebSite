import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createInspectionToken } from '@/lib/inspection-link';
import { sendTemplateEmail } from '@/lib/email-delivery';
import { INSPECTION_BUCKET } from '@/lib/inspection-storage';

const LOGO_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png';

/**
 * Called once the browser's TUS upload has finished. Hashes the uploaded
 * video server-side (never trusting a client-computed hash), releases the
 * upload slot, and sends the "please sign" email — mirroring how
 * admin/bookings/[id] sends its confirmation email from the transition that
 * actually happened, not from client say-so.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: inspection, error } = await supabase
    .from('vehicle_inspections')
    .select(
      'id, type, video_path, video_sha256, booking:bookings(id, customer_name, customer_email, vehicle:vehicles(make, model))'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin/inspections/complete] lookup failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!inspection) {
    return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
  }
  if (!inspection.video_path) {
    return NextResponse.json({ error: 'No video path on this inspection' }, { status: 400 });
  }

  // Idempotent: a retried "complete" call (e.g. a flaky connection right
  // after the upload) just re-sends the same result rather than re-hashing
  // or re-emailing.
  if (!inspection.video_sha256) {
    const { data: file, error: downloadError } = await supabase.storage
      .from(INSPECTION_BUCKET)
      .download(inspection.video_path);
    if (downloadError || !file) {
      console.error('[admin/inspections/complete] video not found in storage:', downloadError?.message);
      return NextResponse.json({ error: 'Uploaded video not found — try again' }, { status: 409 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const { error: updateError } = await supabase
      .from('vehicle_inspections')
      .update({ video_sha256: sha256 })
      .eq('id', id);
    if (updateError) {
      console.error('[admin/inspections/complete] hash update failed:', updateError.message);
      return NextResponse.json({ error: 'Failed to record video hash' }, { status: 500 });
    }

    await supabase.from('inspection_upload_slots').delete().eq('inspection_id', id);
  }

  const key = `vehicle_inspection_sign:${id}`;
  const token = createInspectionToken(id);
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

  return NextResponse.json({ ok: true, signLinkSent });
}
