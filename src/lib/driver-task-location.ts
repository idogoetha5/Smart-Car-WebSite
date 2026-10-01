import { createAdminClient } from '@/lib/supabase/server';

/** Placeholder stored on bookings when no address was given. */
export const UNSPECIFIED_LOCATION = 'לא צוין';
const MAX_LOCATION = 200;

/**
 * Sets the address a task's driver navigates to (Waze). A pickup task uses
 * the booking's pickup_location, a return task its dropoff_location. Empty
 * clears it back to "not specified". Optional everywhere.
 */
export async function setTaskLocation(taskId: string, rawLocation: unknown): Promise<{ ok: boolean; status: number; error?: string }> {
  const location = String(rawLocation ?? '').trim().slice(0, MAX_LOCATION) || UNSPECIFIED_LOCATION;
  const supabase = createAdminClient();
  const { data: task, error } = await supabase.from('driver_tasks').select('id, type, booking_id').eq('id', taskId).maybeSingle();
  if (error) {
    console.error('[driver-task-location] task lookup failed:', error.message);
    return { ok: false, status: 500, error: 'שגיאת שרת' };
  }
  if (!task) return { ok: false, status: 404, error: 'המשימה לא נמצאה' };

  if (task.type === 'service') {
    const { error: ownError } = await supabase
      .from('driver_tasks')
      .update({ location: location === UNSPECIFIED_LOCATION ? null : location })
      .eq('id', taskId);
    if (ownError) {
      console.error('[driver-task-location] service update failed:', ownError.message);
      return { ok: false, status: 500, error: 'עדכון הכתובת נכשל' };
    }
    return { ok: true, status: 200 };
  }

  const column = task.type === 'pickup' ? 'pickup_location' : 'dropoff_location';
  const { error: updateError } = await supabase.from('bookings').update({ [column]: location }).eq('id', task.booking_id);
  if (updateError) {
    console.error('[driver-task-location] booking update failed:', updateError.message);
    return { ok: false, status: 500, error: 'עדכון הכתובת נכשל' };
  }
  return { ok: true, status: 200 };
}
