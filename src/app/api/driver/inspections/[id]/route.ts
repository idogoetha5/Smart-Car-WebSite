import { NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { getInspectionStatus } from '@/lib/inspection-actions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await getInspectionStatus(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
