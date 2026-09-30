import { NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { sendInspectionSignLink } from '@/lib/inspection-actions';

/** Fallback when the customer isn't present: email them a link to review and sign. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await sendInspectionSignLink(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, signLinkSent: result.data.signLinkSent, signLink: result.data.signLink });
}
