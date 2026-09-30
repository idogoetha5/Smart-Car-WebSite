import { createAdminClient } from '@/lib/supabase/server';
import { createInspectionToken } from '@/lib/inspection-link';
import type { DamageMark } from '@/lib/inspection-damage';

export interface HandoverDamage {
  inspectionId: string;
  marks: DamageMark[];
  /** Token for /insp-photo of the handover inspection's photos. */
  mediaToken: string;
}

/**
 * Damage recorded at handover (pickup) for a booking — shown grey on the
 * return inspection so the driver only marks what's new, and used to flag
 * new damage to the office. Prefers the latest signed handover; falls back
 * to the latest one at all.
 */
export async function loadHandoverDamage(bookingId: string): Promise<HandoverDamage | null> {
  if (!bookingId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select('id, status, damage_marks, created_at')
    .eq('booking_id', bookingId)
    .eq('type', 'pickup')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    console.error('[inspection-previous] lookup failed:', error.message);
    return null;
  }
  const rows = data ?? [];
  const row = rows.find((r) => r.status === 'signed') ?? rows[0];
  if (!row) return null;
  return {
    inspectionId: row.id,
    marks: ((row.damage_marks ?? []) as DamageMark[]),
    mediaToken: createInspectionToken(row.id, 24),
  };
}
