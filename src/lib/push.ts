import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/server';
import type { PushMessage } from '@/lib/push-messages';

/**
 * Web Push sender for the driver/manager apps. Needs VAPID keys in the env
 * (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT). Without
 * them every send is a silent no-op, so nothing else in the app depends on
 * notifications working. Failures are logged, never thrown.
 */

let configured: boolean | null = null;

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = vapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || 'mailto:office@smartcar.co.il', publicKey, privateKey);
  configured = true;
  return true;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one message to every device of the given drivers/managers. */
export async function sendPushToDrivers(driverIds: Array<string | null | undefined>, message: PushMessage): Promise<void> {
  const ids = [...new Set(driverIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0 || !ensureConfigured()) return;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('driver_id', ids)
      .returns<SubscriptionRow[]>();
    if (error) {
      console.error('[push] subscription lookup failed:', error.message);
      return;
    }

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url,
      tag: message.tag,
    });

    const gone: string[] = [];
    const used: string[] = [];
    await Promise.allSettled(
      (data ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 6 * 60 * 60, urgency: 'high' }
          );
          used.push(sub.id);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404/410: the phone unsubscribed or the app was removed.
          if (status === 404 || status === 410) gone.push(sub.id);
          else console.error('[push] send failed:', status, (err as Error).message);
        }
      })
    );

    if (gone.length) await supabase.from('push_subscriptions').delete().in('id', gone);
    if (used.length) await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).in('id', used);
  } catch (err) {
    console.error('[push] send threw:', err);
  }
}

/** Sends to every active branch manager. */
export async function sendPushToManagers(message: PushMessage): Promise<void> {
  if (!ensureConfigured()) return;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('drivers').select('id').eq('role', 'manager').eq('active', true);
  if (error) {
    console.error('[push] manager lookup failed:', error.message);
    return;
  }
  await sendPushToDrivers((data ?? []).map((m) => m.id), message);
}

/** Driver ids (drivers or managers) that have at least one device with notifications on. */
export async function driversWithPush(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('push_subscriptions').select('driver_id');
  if (error) return new Set();
  return new Set((data ?? []).map((r: { driver_id: string }) => r.driver_id));
}
