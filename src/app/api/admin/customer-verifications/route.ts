import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { normalizePhone } from '@/lib/accident-report/schema';
import { LINK_TTL_HOURS, NO_STORE } from '@/lib/customer-verification/server';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

const LIST_COLUMNS =
  'id, status, customer_name, customer_phone, booking_ref, locale, expires_at, completed_at, card_last4, card_brand, card_expiry, created_at';

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from('customer_verifications')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: 'server' }, { status: 500 });
  return NextResponse.json({ data }, { headers: NO_STORE });
}

/** Creates a personal link to send the customer over WhatsApp. */
export async function POST(request: Request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(s(body.phone, 30));
  if (phone.replace(/\D/g, '').length < 9) return NextResponse.json({ error: 'phone' }, { status: 400 });

  const token = randomBytes(24).toString('base64url');
  const { data, error } = await createAdminClient()
    .from('customer_verifications')
    .insert({
      token,
      customer_name: s(body.name, 120) || null,
      customer_phone: phone,
      booking_ref: s(body.bookingRef, 60) || null,
      locale: body.lang === 'en' ? 'en' : 'he',
      expires_at: new Date(Date.now() + LINK_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[cv-admin] create', error?.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, token }, { headers: NO_STORE });
}
