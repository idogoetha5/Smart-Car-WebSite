import { NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { setTaskLocation } from '@/lib/driver-task-location';
import { createAdminClient } from '@/lib/supabase/server';
import { inBackground, notifyUrgentClaimed } from '@/lib/push-notify';

/** Driver: add/edit a task's address (Waze), or mark it done / not done. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok, driverId } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);

  // "אני לוקח": take an open urgent task nobody has yet. First tap wins.
  if (body?.claim === true) {
    if (!driverId) return NextResponse.json({ error: 'רק נהג יכול לקחת משימה' }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('driver_tasks')
      .update({ assigned_driver_id: driverId })
      .eq('id', id)
      .eq('status', 'open')
      .is('assigned_driver_id', null)
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('[driver/tasks] claim failed:', error.message);
      return NextResponse.json({ error: 'הפעולה נכשלה' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'נהג אחר כבר לקח את המשימה' }, { status: 409 });
    const { data: me } = await supabase.from('drivers').select('name').eq('id', driverId).maybeSingle();
    inBackground(() => notifyUrgentClaimed(id, me?.name ?? ''));
    return NextResponse.json({ ok: true });
  }
  const hasLocation = Boolean(body) && 'location' in body;
  const status = body?.status === 'done' || body?.status === 'open' ? body.status : null;
  if (!hasLocation && !status) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  if (hasLocation) {
    const result = await setTaskLocation(id, body.location);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (status) {
    // Driver marks a task done (or undoes it). Done tasks leave the
    // driver's lists 24h after being marked.
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('driver_tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'cancelled')
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('[driver/tasks] status update failed:', error.message);
      return NextResponse.json({ error: 'העדכון נכשל' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'המשימה לא נמצאה' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
