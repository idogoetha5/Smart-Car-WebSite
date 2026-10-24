import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { evaluateGeminiModel } from '@/lib/whatsapp-model-evaluation';
import { POST as simulate } from '@/app/api/whatsapp/simulator/route';

export const runtime = 'nodejs';

/** Fixed-model, owner-only comparison. Uses the same isolated flow as the demo:
 * no customer messages, bookings or persistent customer state are created. */
export async function POST(request: NextRequest) {
  const jar = await cookies();
  if (!await verifyAdminToken(jar.get('admin_auth')?.value ?? '')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const limit = await checkRateLimit('whatsapp-owner-model-evaluation', 12, 60 * 60_000);
  if (!limit.success) return NextResponse.json({ error: 'Evaluation limit reached' }, { status: 429 });
  const raw = await request.text();
  if (raw.length > 256_000) return NextResponse.json({ error: 'Evaluation too large' }, { status: 413 });
  const headers = new Headers(request.headers);
  headers.set('x-smartcar-debug', '1');
  headers.set('x-smartcar-engine', 'ai');
  headers.delete('x-smartcar-models');
  const rehearsal = new NextRequest(request.url, { method: 'POST', headers, body: raw });
  const started = Date.now();
  const { result, evaluation } = await evaluateGeminiModel(() => simulate(rehearsal));
  return NextResponse.json({ ...await result.json(), evaluation: { ...evaluation, durationMs: Date.now() - started } }, {
    status: result.status, headers: { 'Cache-Control': 'private, no-store' },
  });
}
