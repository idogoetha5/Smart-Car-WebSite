import { createHmac } from 'node:crypto';
import { maskCard } from '@/lib/customer-verification/card';
import { encryptCard, encryptionConfigured } from '@/lib/customer-verification/crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { declarationSubmission } from '@/lib/rental-declaration';
import { emailDeclaration, normalizeDeclarationSignature, renderDeclarationPdf } from '@/lib/rental-declaration-server';
import { readJsonBody } from '@/lib/request-body';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const maxDuration = 60;

export function GET() {
  return NextResponse.json({ siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '' });
}

const result = (id: string, officeNotified: boolean) => NextResponse.json(
  { id, officeNotified }, { status: 201, headers: { 'Cache-Control': 'no-store' } }
);

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === 'preview') return NextResponse.json({ error: 'unavailable' }, { status: 403 });
  if (!encryptionConfigured()) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rate = await checkRateLimit('signed-declaration:' + ip, 28, 60 * 60 * 1000);
  if (!rate.success) return NextResponse.json({ error: 'rate_limit' }, {
    status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 60) },
  });
  const raw = await readJsonBody(request, 185_000);
  if (!raw.ok) return NextResponse.json({ error: 'invalid' }, { status: raw.status });
  const parsed = declarationSubmission.safeParse(raw.value);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { token, ...value } = parsed.data;
  if (!await verifyTurnstile(token)) return NextResponse.json({ error: 'verification' }, { status: 400 });

  const db = createAdminClient();
  const fields = 'id, request_hash, pdf_base64, office_email_sent_at';
  const requestHash = createHmac('sha256', Buffer.from(process.env.CARD_ENCRYPTION_KEY!.trim(), 'base64'))
    .update('rental-declaration:').update(JSON.stringify(value)).digest('hex');
  const found = await db.from('rental_declarations').select(fields).eq('id', value.id).maybeSingle();
  if (found.error) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  if (found.data) {
    if (found.data.request_hash !== requestHash) return NextResponse.json({ error: 'conflict' }, { status: 409 });
    return result(found.data.id, await emailDeclaration(found.data));
  }

  let signature;
  try {
    signature = await normalizeDeclarationSignature(value.signature);
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const signedAt = new Date().toISOString();
  const [expMonth, expYear] = value.fields.cardExpiry.split('/');
  const cardCiphertext = encryptCard({
    number: value.fields.cardNumber, expMonth, expYear, holderName: value.fields.cardHolder,
    holderIdType: 'il', holderId: '',
  });
  const safeFields = { ...value.fields, cardNumber: maskCard(value.fields.cardNumber.slice(-4)) };
  let pdf;
  try {
    pdf = await renderDeclarationPdf({ ...parsed.data, fields: safeFields, signature });
  } catch {
    console.error('[rental-declaration] PDF rendering failed');
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  const stored = await db.from('rental_declarations').insert({
    id: value.id, request_hash: requestHash, full_name: value.fields.name, locale: value.locale,
    form_data: safeFields, card_ciphertext: cardCiphertext, signature_type: signature.type, signed_at: signedAt, pdf_base64: pdf.toString('base64'),
  }).select(fields).single();
  if (stored.data) return result(stored.data.id, await emailDeclaration(stored.data));
  if (stored.error?.code === '23505') {
    const concurrent = await db.from('rental_declarations').select(fields).eq('id', value.id).maybeSingle();
    if (concurrent.data?.request_hash === requestHash) {
      return result(concurrent.data.id, await emailDeclaration(concurrent.data));
    }
    if (concurrent.data) return NextResponse.json({ error: 'conflict' }, { status: 409 });
  }
  console.error('[rental-declaration] write failed');
  return NextResponse.json({ error: 'unavailable' }, { status: 503 });
}
