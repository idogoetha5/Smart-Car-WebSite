import { NextResponse } from 'next/server';
import { requireDriverOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { vapidPublicKey } from '@/lib/push';

/** The public VAPID key the phone needs to turn notifications on (null = not set up yet). */
export async function GET() {
  const { ok } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ publicKey: vapidPublicKey() });
}

/** Save this device's push subscription for the logged-in driver/manager. */
export async function POST(request: Request) {
  const { ok, driverId } = await requireDriverOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!driverId) return NextResponse.json({ error: 'התראות זמינות רק לנהגים ולמנהלים' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const endpoint = String(body?.subscription?.endpoint ?? '');
  const p256dh = String(body?.subscription?.keys?.p256dh ?? '');
  const auth = String(body?.subscription?.keys?.auth ?? '');
  if (!endpoint.startsWith('https://') || !p256dh || !auth || endpoint.length > 1000) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from('push_subscriptions')
    .upsert(
      {
        driver_id: driverId,
        endpoint,
        p256dh,
        auth,
        user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
      },
      { onConflict: 'endpoint' }
    );
  if (error) {
    console.error('[driver/push] save failed:', error.message);
    return NextResponse.json({ error: 'שמירת ההתראות נכשלה' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Turn notifications off on this device. */
export async function DELETE(request: Request) {
  const { ok, driverId } = await requireDriverOrAdmin();
  if (!ok || !driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const endpoint = String(body?.endpoint ?? '');
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  await createAdminClient().from('push_subscriptions').delete().eq('endpoint', endpoint).eq('driver_id', driverId);
  return NextResponse.json({ ok: true });
}
