import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { decryptCard } from '@/lib/customer-verification/crypto';
import { clientIp, NO_STORE, logAccess } from '@/lib/customer-verification/server';

export const runtime = 'nodejs';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

/** Reveals the full card details for a charge. Every reveal is written to the access log. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await checkRateLimit(`cv-reveal:${clientIp(request)}`, 30, 60 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const { id } = await params;
  const { data } = await createAdminClient()
    .from('customer_verifications')
    .select('card_ciphertext')
    .eq('id', id)
    .maybeSingle();
  if (!data?.card_ciphertext) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    const card = decryptCard(data.card_ciphertext);
    await logAccess(request, id, 'REVEAL_CARD');
    return NextResponse.json(
      { number: card.number, expiry: `${card.expMonth}/${card.expYear}`, holderIdType: card.holderIdType, holderId: card.holderId },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error('[cv-reveal] decrypt failed', (e as Error).message);
    return NextResponse.json({ error: 'decrypt' }, { status: 500 });
  }
}

/** Deletes the stored card details for good (e.g. once the rental is fully settled). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { error } = await createAdminClient()
    .from('customer_verifications')
    .update({ card_ciphertext: null })
    .eq('id', id);
  if (error) return NextResponse.json({ error: 'server' }, { status: 500 });
  await logAccess(request, id, 'DELETE_CARD');
  return NextResponse.json({ ok: true });
}
