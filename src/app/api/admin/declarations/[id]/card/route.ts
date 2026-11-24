import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminToken } from '@/lib/admin-auth';
import { clientIp } from '@/lib/customer-verification/server';
import { decryptCard } from '@/lib/customer-verification/crypto';
import { checkRateLimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const respond = (status: number) => NextResponse.json({}, { status, headers });
  if (request.headers.get('origin') !== new URL(request.url).origin) return respond(403);
  if (!await verifyAdminToken((await cookies()).get('admin_auth')?.value ?? '')) return respond(401);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return respond(404);
  const rate = await checkRateLimit('declaration-card-reveal:' + clientIp(request), 30, 3_600_000);
  if (!rate.success) return respond(429);
  const db = createAdminClient();
  const { data, error } = await db.from('rental_declarations').select('card_ciphertext').eq('id', id).maybeSingle();
  if (error || !data) return respond(error ? 503 : 404);
  try {
    const card = decryptCard(data.card_ciphertext);
    const audit = await db.from('rental_declaration_card_access').insert({ declaration_id: id });
    if (audit.error) return respond(503);
    return NextResponse.json({ number: card.number, expiry: card.expMonth + '/' + card.expYear }, { headers });
  } catch {
    return respond(503);
  }
}
