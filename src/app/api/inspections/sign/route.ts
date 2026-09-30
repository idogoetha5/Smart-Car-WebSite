import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { verifyInspectionToken } from '@/lib/inspection-link';
import { loadSignView, signInspection } from '@/lib/inspection-signing';

// Renders the signed PDF with headless Chromium, then emails customer + office.
export const maxDuration = 60;

/** Remote signing via the customer's emailed link: data for the sign screen. */
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit } = await checkRateLimit(`inspection-sign:${ip}`, 30, 60 * 60 * 1000);
  if (!withinLimit) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const token = request.nextUrl.searchParams.get('token');
  const link = verifyInspectionToken(token);
  if (!link.valid) {
    return NextResponse.json(
      { error: link.reason === 'expired' ? 'expired' : 'invalid' },
      { status: link.reason === 'expired' ? 410 : 404 }
    );
  }

  const view = await loadSignView(link.inspectionId!, token as string);
  if (!view.ok) return NextResponse.json({ error: view.error }, { status: view.status });
  return NextResponse.json({ data: view.data });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit, retryAfter } = await checkRateLimit(`inspection-sign-submit:${ip}`, 5, 60 * 60 * 1000);
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'יותר מדי בקשות. נסו שוב מאוחר יותר.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const body = await request.json().catch(() => null);
  const link = verifyInspectionToken(body?.token);
  if (!link.valid) {
    return NextResponse.json(
      { error: link.reason === 'expired' ? 'הקישור פג תוקף.' : 'קישור לא תקין.' },
      { status: link.reason === 'expired' ? 410 : 404 }
    );
  }

  if (!await verifyTurnstile(body?.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  const result = await signInspection({
    inspectionId: link.inspectionId!,
    signatureDataUrl: body?.signatureDataUrl,
    declarationAccepted: Boolean(body?.declarationAccepted),
    signerIp: ip,
    signerUserAgent: request.headers.get('user-agent') ?? '',
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
