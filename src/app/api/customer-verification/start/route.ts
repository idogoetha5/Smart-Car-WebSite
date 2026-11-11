import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { isValidPhone, normalizePhone } from '@/lib/accident-report/schema';
import { clientIp, NO_STORE, PUBLIC_LINK_TTL_HOURS, PUBLIC_TOKEN_PREFIX } from '@/lib/customer-verification/server';

/**
 * The fixed link (/he|en/customer-verification without a token): the
 * customer types name and phone, passes the bot check, and gets a short-lived
 * personal token. From there the flow is exactly the personal-link flow.
 * Tokens from here start with "p_" so the admin can tell the two apart and
 * hide abandoned starts.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = await checkRateLimit(`cv-start:${ip}`, 6, 60 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const phoneRaw = String(body?.phone ?? '').trim().slice(0, 30);
  const fields: string[] = [];
  if (name.length < 2) fields.push('name');
  if (!isValidPhone(phoneRaw)) fields.push('phone');
  if (fields.length) return NextResponse.json({ error: 'invalid', fields }, { status: 400 });

  if (!(await verifyTurnstile(String(body?.turnstileToken ?? '')))) {
    return NextResponse.json({ error: 'turnstile' }, { status: 400 });
  }

  const token = PUBLIC_TOKEN_PREFIX + randomBytes(24).toString('base64url');
  const { error } = await createAdminClient().from('customer_verifications').insert({
    token,
    customer_name: name,
    customer_phone: normalizePhone(phoneRaw),
    locale: body?.lang === 'en' ? 'en' : 'he',
    expires_at: new Date(Date.now() + PUBLIC_LINK_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    internal_notes: 'מולא דרך הקישור הקבוע',
  });
  if (error) {
    console.error('[cv-start]', error.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
  return NextResponse.json({ token }, { headers: NO_STORE });
}
