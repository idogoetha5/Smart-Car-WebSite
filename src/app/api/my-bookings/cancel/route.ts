import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { normalizeEmail } from '@/lib/email';

const PG_INVALID_ENUM = '22P02';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success, retryAfter } = await checkRateLimit(`my-bookings-cancel:${ip}`, 5, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  // Email comes from the authenticated session — not trusted from the request body
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = normalizeEmail(user.email);

  const body = await request.json().catch(() => null);
  const bookingId = String(body?.bookingId ?? '').trim();

  if (!bookingId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status, customer_email')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    if (process.env.NODE_ENV !== 'production') console.error('[cancel] fetch error:', fetchError?.message);
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (!booking.customer_email || normalizeEmail(booking.customer_email as string) !== email) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 });
  }

  // Ownership was just verified above against the normalized value. The
  // UPDATE below must therefore match the email exactly as stored, which
  // may still be un-normalized for rows predating the normalization
  // migration — use the stored value rather than the normalized one so a
  // legitimate cancellation is never rejected because of casing.
  const storedEmail = booking.customer_email as string;

  if (booking.status !== 'PENDING') {
    return NextResponse.json({ error: 'Only pending bookings can be cancelled' }, { status: 409 });
  }

  // The status='PENDING' condition is re-checked atomically as part of the
  // UPDATE's WHERE clause (not just the earlier SELECT above), so a
  // concurrent admin confirmation between the fetch and this write can't be
  // silently overwritten — if 0 rows match, someone else changed it first.
  let finalStatus = 'CANCELLED_BY_CUSTOMER';
  let { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update({ status: finalStatus })
    .eq('id', bookingId)
    .eq('customer_email', storedEmail)
    .eq('status', 'PENDING')
    .select('id');

  if (updateError?.code === PG_INVALID_ENUM || updateError?.message?.includes('invalid input value for enum')) {
    if (process.env.NODE_ENV !== 'production') console.warn('[cancel] CANCELLED_BY_CUSTOMER not in enum — falling back to CANCELLED.');
    finalStatus = 'CANCELLED';
    ({ data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({ status: finalStatus })
      .eq('id', bookingId)
      .eq('customer_email', storedEmail)
      .eq('status', 'PENDING')
      .select('id'));
  }

  if (updateError) {
    if (process.env.NODE_ENV !== 'production') console.error('[cancel] update error:', updateError.message);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Booking status changed — please refresh' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, status: finalStatus });
}
