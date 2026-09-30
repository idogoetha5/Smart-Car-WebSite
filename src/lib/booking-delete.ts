import { createAdminClient } from '@/lib/supabase/server';
import { INSPECTION_BUCKET } from '@/lib/inspection-storage';

/**
 * Deletes a booking and everything that hangs off it. The database blocks
 * a plain delete once a booking has a vehicle inspection (ON DELETE
 * RESTRICT) or WhatsApp messages linked to it, which is why deleting
 * driver-app bookings failed with "שגיאה במחיקה". Order:
 *   1. unlink WhatsApp messages (the chat history stays),
 *   2. remove each inspection's files (video, photos, signature, signed PDF)
 *      and its row (outbox / upload-slot rows cascade),
 *   3. delete the booking (driver tasks cascade, condition reports unlink).
 */
export async function deleteBookingCascade(bookingId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  const { error: waError } = await supabase.from('whatsapp_messages').update({ booking_id: null }).eq('booking_id', bookingId);
  if (waError) console.error('[booking-delete] whatsapp unlink failed:', waError.message);

  const { data: inspections, error: inspError } = await supabase
    .from('vehicle_inspections')
    .select('id')
    .eq('booking_id', bookingId);
  if (inspError) {
    console.error('[booking-delete] inspection lookup failed:', inspError.message);
    return { ok: false, error: 'שגיאת שרת, נסה שוב' };
  }

  const bucket = supabase.storage.from(INSPECTION_BUCKET);
  for (const { id } of inspections ?? []) {
    const paths: string[] = [];
    for (const folder of [id, `${id}/marks`, `${id}/sides`]) {
      const { data: files } = await bucket.list(folder, { limit: 100 });
      for (const f of files ?? []) {
        // Sub-folders show up as entries without an id; only remove files.
        if (f.id) paths.push(`${folder}/${f.name}`);
      }
    }
    if (paths.length) {
      const { error: rmError } = await bucket.remove(paths);
      if (rmError) console.error('[booking-delete] storage cleanup failed for %s: %s', id, rmError.message);
    }
  }

  if ((inspections ?? []).length) {
    const { error: delInspError } = await supabase.from('vehicle_inspections').delete().eq('booking_id', bookingId);
    if (delInspError) {
      console.error('[booking-delete] inspection delete failed:', delInspError.message);
      return { ok: false, error: 'מחיקת בדיקות הרכב של ההזמנה נכשלה' };
    }
  }

  const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
  if (error) {
    console.error('[booking-delete] booking delete failed:', error.message);
    return { ok: false, error: `מחיקת ההזמנה נכשלה: ${error.message}` };
  }
  return { ok: true };
}
