import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { setTaskLocation } from '@/lib/driver-task-location';
import { inBackground, loadTaskSnapshot, notifyTaskChanged } from '@/lib/push-notify';

async function rescheduleTask(
  id: string,
  scheduledAt: unknown,
  scheduledTime: unknown
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = createAdminClient();
  const { data: task, error } = await supabase
    .from('driver_tasks')
    .select('type, booking_id, booking:bookings(pickup_date, dropoff_date)')
    .eq('id', id)
    .maybeSingle<{ type: string; booking_id: string | null; booking: { pickup_date: string; dropoff_date: string } | null }>();
  if (error) {
    console.error('[driver-task-update] task lookup failed:', error.message);
    return { ok: false, status: 500, error: 'שגיאת שרת' };
  }
  if (task?.type === 'service') {
    // Garage jobs keep their own day/time on the task.
    const own: Record<string, unknown> = {};
    if (typeof scheduledAt === 'string' && scheduledAt) {
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) return { ok: false, status: 400, error: 'תאריך לא תקין' };
      own.scheduled_at = when.toISOString();
    }
    if (typeof scheduledTime === 'string') {
      if (scheduledTime && !/^\d{2}:\d{2}$/.test(scheduledTime)) return { ok: false, status: 400, error: 'שעה לא תקינה' };
      own.scheduled_time = scheduledTime || null;
    }
    if (Object.keys(own).length === 0) return { ok: true };
    const { error: ownError } = await supabase.from('driver_tasks').update(own).eq('id', id);
    if (ownError) {
      console.error('[driver-task-update] service reschedule failed:', ownError.message);
      return { ok: false, status: 500, error: 'עדכון המועד נכשל' };
    }
    return { ok: true };
  }
  if (!task?.booking_id) return { ok: false, status: 404, error: 'המשימה לא נמצאה' };

  const isPickup = task.type === 'pickup';
  const update: Record<string, unknown> = {};
  if (typeof scheduledAt === 'string' && scheduledAt) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return { ok: false, status: 400, error: 'תאריך לא תקין' };
    update[isPickup ? 'pickup_date' : 'dropoff_date'] = when.toISOString();
    // Keep the rental consistent: return never before pickup.
    const other = new Date((isPickup ? task.booking?.dropoff_date : task.booking?.pickup_date) ?? '').getTime();
    if (!Number.isNaN(other)) {
      if (isPickup && when.getTime() > other) update.dropoff_date = new Date(when.getTime() + 86_400_000).toISOString();
      if (!isPickup && when.getTime() < other) update.pickup_date = when.toISOString();
    }
  }
  if (typeof scheduledTime === 'string') {
    if (scheduledTime && !/^\d{2}:\d{2}$/.test(scheduledTime)) return { ok: false, status: 400, error: 'שעה לא תקינה' };
    update[isPickup ? 'pickup_time' : 'return_time'] = scheduledTime || null;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error: updateError } = await supabase.from('bookings').update(update).eq('id', task.booking_id);
  if (updateError) {
    console.error('[driver-task-update] reschedule failed:', updateError.message);
    return { ok: false, status: 500, error: 'עדכון המועד נכשל' };
  }
  return { ok: true };
}

/** Reassign, edit notes/address/date/time, or cancel a task — shared by admin and branch managers. */
export async function updateDriverTask(request: Request, id: string): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  // Snapshot before the edit, so the driver can be told what changed.
  const before = await loadTaskSnapshot(id);
  const changes = {
    reassigned: 'assignedDriverId' in (body ?? {}),
    rescheduled: typeof body?.scheduledAt === 'string' || typeof body?.scheduledTime === 'string',
    addressChanged: 'location' in (body ?? {}),
  };
  const response = await applyTaskUpdate(body, id);
  if (before && response.ok) inBackground(() => notifyTaskChanged(before, changes));
  return response;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyTaskUpdate(body: any, id: string): Promise<NextResponse> {
  const update: Record<string, unknown> = {};

  if ('assignedDriverId' in (body ?? {})) update.assigned_driver_id = body.assignedDriverId || null;
  if (typeof body?.notes === 'string') update.notes = body.notes.trim() || null;
  if (body?.status === 'open' || body?.status === 'done' || body?.status === 'cancelled') {
    update.status = body.status;
  }

  // Reschedule: new date (ISO) and/or time (HH:MM, '' clears) on the rental,
  // on the side (pickup/return) this task is for.
  const hasSchedule = typeof body?.scheduledAt === 'string' || typeof body?.scheduledTime === 'string';
  if (hasSchedule) {
    const result = await rescheduleTask(id, body.scheduledAt, body.scheduledTime);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (Object.keys(update).length === 0 && !('location' in (body ?? {}))) return NextResponse.json({ success: true });
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
