import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { clientIp, CV_BUCKET, NO_STORE, openVerificationByToken } from '@/lib/customer-verification/server';

export const runtime = 'nodejs';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** One-time signed URL so the phone uploads the licence photo straight to the private bucket. */
export async function POST(request: Request) {
  const limit = await checkRateLimit(`cv-upload:${clientIp(request)}`, 20, 10 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = await request.json().catch(() => null);
  const side = body?.side === 'back' ? 'back' : body?.side === 'front' ? 'front' : null;
  const ext = EXT[String(body?.contentType ?? '')];
  const row = await openVerificationByToken(String(body?.t ?? ''));
  if (!row) return NextResponse.json({ error: 'invalid_link' }, { status: 410 });
  if (!side || !ext) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const path = `${row.id}/license-${side}-${randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from(CV_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[cv-upload]', error?.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
  return NextResponse.json({ path, token: data.token }, { headers: NO_STORE });
}
