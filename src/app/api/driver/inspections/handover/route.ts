import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { loadHandoverDamage } from '@/lib/inspection-previous';

/** Damage recorded at handover for a booking — pre-drawn (grey) on the return inspection. */
export async function GET(request: NextRequest) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const bookingId = request.nextUrl.searchParams.get('bookingId') ?? '';
  const handover = await loadHandoverDamage(bookingId);
  if (!handover) return NextResponse.json({ data: null });
  return NextResponse.json({
    data: {
      inspectionId: handover.inspectionId,
      mediaToken: handover.mediaToken,
      marks: handover.marks.map((m) => ({
        n: m.n,
        view: m.view,
        x: m.x,
        y: m.y,
        kind: m.kind,
        note: m.note,
        hasPhoto: Boolean(m.photo_path),
      })),
    },
  });
}
