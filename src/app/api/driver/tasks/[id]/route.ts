import { NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { setTaskLocation } from '@/lib/driver-task-location';

/** Driver adds/edits the address of a task (for Waze). Optional. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !('location' in body)) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const result = await setTaskLocation(id, body.location);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
