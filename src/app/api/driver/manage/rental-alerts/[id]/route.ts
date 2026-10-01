import { NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { setRentalAlertResolved } from '@/lib/rental-alerts';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, managerId } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved is required' }, { status: 400 });
  }
  return setRentalAlertResolved({ returnInspectionId: id, resolved: body.resolved, managerId });
}
