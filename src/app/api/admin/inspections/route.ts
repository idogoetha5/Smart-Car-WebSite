import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { INSPECTION_BUCKET, inspectionVideoPath } from '@/lib/inspection-storage';

const ALLOWED_EXT = new Set(['mp4', 'mov', 'webm']);

/**
 * Starts a pickup/return inspection: creates the row and pre-authorises
 * exactly one direct-to-storage video upload (see
 * database/migrations/add-vehicle-inspections-table.sql for the storage RLS
 * policy this backs). The browser then uploads the video itself via TUS —
 * it never passes through this (or any) Vercel function, which caps
 * request bodies at 4.5MB.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const bookingId = String(body?.bookingId ?? '').trim();
  const type = body?.type === 'pickup' || body?.type === 'return' ? body.type : null;
  const odometerKm = Number(body?.odometerKm);
  const fuelEighths = Number(body?.fuelEighths);
  const videoExt = String(body?.videoExt ?? 'mp4').toLowerCase();

  if (!bookingId || !type) {
    return NextResponse.json({ error: 'bookingId and type are required' }, { status: 400 });
  }
  if (!Number.isFinite(odometerKm) || odometerKm < 0) {
    return NextResponse.json({ error: 'Invalid odometer reading' }, { status: 400 });
  }
  if (![0, 2, 4, 6, 8].includes(fuelEighths)) {
    return NextResponse.json({ error: 'Invalid fuel level' }, { status: 400 });
  }
  if (!ALLOWED_EXT.has(videoExt)) {
    return NextResponse.json({ error: 'Unsupported video type' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingError) {
    console.error('[admin/inspections] booking lookup failed:', bookingError.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const { data: inspection, error: insertError } = await supabase
    .from('vehicle_inspections')
    .insert({ booking_id: bookingId, type, odometer_km: Math.round(odometerKm), fuel_eighths: fuelEighths })
    .select('id')
    .single();
  if (insertError || !inspection) {
    console.error('[admin/inspections] insert failed:', insertError?.message);
    return NextResponse.json({ error: 'Failed to create inspection' }, { status: 500 });
  }

  const path = inspectionVideoPath(inspection.id, videoExt);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const { error: slotError } = await supabase
    .from('inspection_upload_slots')
    .insert({ path, inspection_id: inspection.id, expires_at: expiresAt });
  if (slotError) {
    console.error('[admin/inspections] upload slot creation failed:', slotError.message);
    return NextResponse.json({ error: 'Failed to authorise upload' }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('[admin/inspections] NEXT_PUBLIC_SUPABASE_URL is not set');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  return NextResponse.json({
    inspectionId: inspection.id,
    bucket: INSPECTION_BUCKET,
    path,
    uploadEndpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
    expiresAt,
  });
}
