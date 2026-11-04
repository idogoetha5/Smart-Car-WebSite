import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Returns a one-time signed URL so the phone uploads the photo straight to storage. */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = await checkRateLimit(`accident-upload:${ip}`, 40, 10 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = await request.json().catch(() => null);
  const draftId = String(body?.draftId ?? '');
  const ext = EXT[String(body?.contentType ?? '')];
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(draftId) || !ext) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const path = `uploads/${draftId}/${randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from('accident-reports').createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[accident-upload]', error?.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
  return NextResponse.json({ path, token: data.token });
}
