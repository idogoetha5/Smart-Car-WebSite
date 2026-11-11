import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { isValidIdOf, normalizePassport } from '@/lib/accident-report/schema';
import { CONSENT_VERSION, cardBrand, digitsOnly, expiryValid, luhnValid } from '@/lib/customer-verification/card';
import { encryptCard, encryptionConfigured } from '@/lib/customer-verification/crypto';
import { clientIp, CV_BUCKET, NO_STORE, openVerificationByToken } from '@/lib/customer-verification/server';

export const runtime = 'nodejs';

const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/**
 * Final submit. The card number, expiry and holder ID are encrypted before
 * they touch the database; only last-4, brand, expiry and holder name are
 * kept in clear for the admin list. A CVV, if one is ever sent, is ignored.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = await checkRateLimit(`cv-submit:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  if (!encryptionConfigured()) {
    console.error('[cv-submit] CARD_ENCRYPTION_KEY is missing – refusing to store card details');
    return NextResponse.json({ error: 'server' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const row = await openVerificationByToken(s(body?.t, 100));
  if (!row) return NextResponse.json({ error: 'invalid_link' }, { status: 410 });

  const front = s(body?.licenseFront, 200);
  const back = s(body?.licenseBack, 200);
  const number = digitsOnly(s(body?.cardNumber, 30));
  const expMonth = digitsOnly(s(body?.expMonth, 2)).padStart(2, '0');
  const expYear = digitsOnly(s(body?.expYear, 4)).slice(-2);
  const holderName = s(body?.holderName, 120);
  const holderIdType = body?.holderIdType === 'passport' ? 'passport' : 'il';
  const holderIdRaw = s(body?.holderId, 30);
  const holderId = holderIdType === 'passport' ? normalizePassport(holderIdRaw) : digitsOnly(holderIdRaw);

  const prefix = `${row.id}/`;
  const errors: string[] = [];
  if (!front.startsWith(prefix) || !back.startsWith(prefix)) errors.push('license');
  if (!luhnValid(number)) errors.push('cardNumber');
  if (!expiryValid(expMonth, expYear)) errors.push('expiry');
  if (!isValidIdOf(holderIdType, holderId)) errors.push('holderId');
  if (body?.consent !== true) errors.push('consent');
  if (errors.length) return NextResponse.json({ error: 'invalid', fields: errors }, { status: 400 });

  // Both photos must really be in storage under this verification's folder.
  const supabase = createAdminClient();
  const { data: files } = await supabase.storage.from(CV_BUCKET).list(row.id, { limit: 100 });
  const names = new Set((files ?? []).map((f) => `${row.id}/${f.name}`));
  if (!names.has(front) || !names.has(back)) {
    return NextResponse.json({ error: 'invalid', fields: ['license'] }, { status: 400 });
  }

  const ciphertext = encryptCard({ number, expMonth, expYear, holderName, holderIdType, holderId });

  // status = 'SENT' in the filter makes the link single-use even under a double tap.
  const { data: updated, error } = await supabase
    .from('customer_verifications')
    .update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      license_front_path: front,
      license_back_path: back,
      card_ciphertext: ciphertext,
      card_last4: number.slice(-4),
      card_brand: cardBrand(number),
      card_expiry: `${expMonth}/${expYear}`,
      card_holder_name: holderName || row.customer_name,
      card_holder_id_type: holderIdType,
      consent_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
      submit_ip: ip,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    })
    .eq('id', row.id)
    .eq('status', 'SENT')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[cv-submit]', error.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: 'invalid_link' }, { status: 410 });
  return NextResponse.json({ ok: true, id: row.id }, { headers: NO_STORE });
}
