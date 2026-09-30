import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { setTaskLocation } from '@/lib/driver-task-location';

/** Reassign, edit notes/address, or cancel a task — shared by admin and branch managers. */
export async function updateDriverTask(request: Request, id: string): Promise<NextResponse> {
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

/**
 * Permanently removes a task — only once it has been cancelled, so an open
 * or completed task can never be deleted by mistake. The booking (and any
 * inspection) is kept.
 */
export async function deleteCancelledTask(id: string): Promise<NextResponse> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('driver_tasks')
    .delete()
    .eq('id', id)
    .eq('status', 'cancelled')
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[driver-task-update] delete failed:', error.message);
    return NextResponse.json({ error: 'המחיקה נכשלה' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'אפשר למחוק רק משימה שבוטלה' }, { status: 409 });
  return NextResponse.json({ success: true });
}
