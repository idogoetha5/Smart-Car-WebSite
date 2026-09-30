import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { setTaskLocation } from '@/lib/driver-task-location';

/** Reassign, edit notes/address, or cancel a task. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const update: Record<string, unknown> = {};

  if ('assignedDriverId' in (body ?? {})) update.assigned_driver_id = body.assignedDriverId || null;
  if (typeof body?.notes === 'string') update.notes = body.notes.trim() || null;
  if (body?.status === 'open' || body?.status === 'done' || body?.status === 'cancelled') {
    update.status = body.status;
  }

  const hasLocation = 'location' in (body ?? {});
  if (hasLocation) {
    const result = await setTaskLocation(id, body.location);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (Object.keys(update).length === 0) return NextResponse.json({ success: true });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('driver_tasks')
    .update(update)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[admin/tasks/[id]] update failed:', error.message);
    return NextResponse.json({ error: 'העדכון נכשל' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'המשימה לא נמצאה' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
