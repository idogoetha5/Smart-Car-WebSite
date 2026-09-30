import { NextRequest, NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createInspectionRecord } from '@/lib/inspection-actions';

export async function POST(request: NextRequest) {
  const { ok, driverId } = await requireDriverOrAdmin();
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = await createInspectionRecord({
    bookingId: String(body?.bookingId ?? '').trim(),
    type: body?.type,
    odometerKm: Number(body?.odometerKm),
    fuelEighths: Number(body?.fuelEighths),
    hasVideo: body?.hasVideo !== false,
    videoExt: String(body?.videoExt ?? 'mp4'),
    damageMarks: body?.damageMarks,
    noDamage: body?.noDamage === true,
    sidePhotoViews: body?.sidePhotoViews,
    driverId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
