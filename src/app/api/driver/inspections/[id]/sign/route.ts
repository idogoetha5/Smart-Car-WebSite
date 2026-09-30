import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createInspectionToken } from '@/lib/inspection-link';
import { loadSignView, signInspection } from '@/lib/inspection-signing';

// Renders the signed PDF with headless Chromium, then emails customer + office.
export const maxDuration = 60;

/**
 * In-person signing on the driver's phone: the customer reviews the
 * inspection and signs right there. Gated by the driver (or admin) login
 * instead of the customer's link token + Turnstile.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const view = await loadSignView(id, createInspectionToken(id, 24));
  if (!view.ok) return NextResponse.json({ error: view.error }, { status: view.status });
  return NextResponse.json({ data: view.data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await signInspection({
    inspectionId: id,
    signatureDataUrl: body?.signatureDataUrl,
    declarationAccepted: Boolean(body?.declarationAccepted),
    signerIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
    signerUserAgent: `in-person on driver phone · ${request.headers.get('user-agent') ?? ''}`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
