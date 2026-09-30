import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { loadHandover, searchHandovers, type HandoverDamage } from '@/lib/inspection-previous';

function toClient(h: HandoverDamage) {
  return {
    inspectionId: h.inspectionId,
    bookingId: h.bookingId,
    customerPhone: h.customerPhone,
    mediaToken: h.mediaToken,
    odometerKm: h.odometerKm,
    fuelEighths: h.fuelEighths,
    customerName: h.customerName,
    vehicleName: h.vehicleName,
    licensePlate: h.licensePlate,
    signedAt: h.signedAt,
    marks: h.marks.map((m) => ({ n: m.n, view: m.view, x: m.x, y: m.y, kind: m.kind, note: m.note, hasPhoto: Boolean(m.photo_path) })),
  };
}

/**
 * Handover (pickup) inspection a return is compared with:
 *   ?bookingId=…      the handover on the same booking (if any)
 *   ?inspectionId=…   a specific handover the driver picked
 *   ?search=…         signed handovers by customer name or plate (picker)
 */
export async function GET(request: NextRequest) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const search = sp.get('search');
  if (search !== null) {
    const results = await searchHandovers(search);
    return NextResponse.json({ data: results.map(toClient) });
  }
  const handover = await loadHandover({ bookingId: sp.get('bookingId'), handoverInspectionId: sp.get('inspectionId') });
  return NextResponse.json({ data: handover ? toClient(handover) : null });
}
