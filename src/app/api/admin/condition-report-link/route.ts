import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createConditionReportToken } from '@/lib/signed-link';

/**
 * Mints the signed condition-report link for a booking.
 *
 * The customer form no longer accepts a booking reference typed by hand,
 * so this is how staff get a usable link to send. Admin-only: anyone able
 * to mint a link could file a report against any booking.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const bookingId = String(body?.bookingId ?? '').trim();
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }

  // Don't hand out a link for a booking that doesn't exist — that would
  // only produce a 404 for the customer later.
  const supabase = createAdminClient();
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('[condition-report-link] lookup failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // 72 hours: long enough to cover a handover that slips a day or two,
  // short enough that a forwarded link doesn't stay usable indefinitely.
  const ttlHours = 72;
  const token = createConditionReportToken(bookingId, ttlHours);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartcar.co.il';
  const url = `${baseUrl}/he/condition-report?token=${encodeURIComponent(token)}`;

  return NextResponse.json({
    url,
    expiresInHours: ttlHours,
    expiresAt: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
  });
}
