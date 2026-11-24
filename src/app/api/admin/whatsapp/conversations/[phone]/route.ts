import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken, verifyInboxToken } from '@/lib/admin-auth';
import { getWhatsAppDeliveryStatus, sendWhatsAppMessage } from '@/lib/whatsapp';
import { logWhatsAppMessage } from '@/lib/whatsapp-conversations';
import { reportBotIncident } from '@/lib/whatsapp-incidents';

/** See src/app/api/admin/whatsapp/conversations/route.ts for why two cookies. */
async function checkAuth() {
  const cookieStore = await cookies();
  const adminOk = await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
  if (adminOk) return true;
  return verifyInboxToken(cookieStore.get('inbox_auth')?.value ?? '');
}

export async function GET(request: Request, { params }: { params: Promise<{ phone: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { phone } = await params;
  const search = new URL(request.url).searchParams;
  const before = search.get('before');
  const after = search.get('after');
  const deliveryId = search.get('delivery');
  const validCursor = (value: string | null) => value === null || (/^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)));
  if (!/^\+?\d{9,15}$/.test(phone) || !validCursor(before) || !validCursor(after) || (before && after)
    || (deliveryId !== null && (before !== null || after !== null || !/^[A-Za-z0-9._-]{1,128}$/.test(deliveryId)))) {
    return NextResponse.json({ error: 'Invalid conversation cursor' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (deliveryId) {
    // Only a representative's message already in this authenticated thread
    // may be queried. This does not expose provider IDs for other customers.
    const { data: owned, error: ownershipError } = await supabase.from('whatsapp_messages')
      .select('id').eq('phone', phone).eq('source', 'human_reply').eq('wa_message_id', deliveryId).maybeSingle();
    if (ownershipError) return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 });
    if (!owned) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    const delivery = await getWhatsAppDeliveryStatus(deliveryId);
    return NextResponse.json({ data: delivery }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  let query = supabase
    .from('whatsapp_messages')
    .select('id, source, body, created_at, escalated_at, wa_message_id')
    .eq('phone', phone);
  if (before) query = query.lt('id', before);
  if (after) query = query.gt('id', after);
  // Identity cursor is stable even when multiple messages share a timestamp.
  // New conversations open at the latest window, never the oldest 200 rows.
  const { data, error } = await query.order('id', { ascending: Boolean(after) }).limit(101);

  if (error) {
    console.error('[admin/whatsapp/conversations/:phone]', error.message);
    return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 });
  }

  const page = (data ?? []).slice(0, 100);
  if (!after) page.reverse();
  return NextResponse.json({ data: page, pagination: {
    hasMore: (data?.length ?? 0) > 100,
    before: page[0]?.id ?? null, after: page.at(-1)?.id ?? null,
  } }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/**
 * Sends a reply as Daniel and logs it as `human_reply` — the same write
 * the `smb_message_echoes` path produces under Coexistence. This one call
 * is the entire silence-rule trigger for this surface.
 */
export async function POST(request: Request, { params }: { params: Promise<{ phone: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { phone } = await params;

  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 4096) return NextResponse.json({ error: 'יש להזין הודעה באורך תקין' }, { status: 400 });

  // A free-form WhatsApp reply is only available during the customer's
  // service window. Refuse locally rather than showing a provider acceptance
  // that may turn into a delayed delivery failure.
  const { data: lastInbound, error: inboundError } = await createAdminClient().from('whatsapp_messages')
    .select('created_at').eq('phone', phone).eq('source', 'customer_inbound')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (inboundError) return NextResponse.json({ error: 'לא ניתן לבדוק כעת מתי הלקוח כתב לאחרונה. ההודעה לא נשלחה.' }, { status: 503 });
  if (!lastInbound || !Number.isFinite(Date.parse(lastInbound.created_at)) || Date.now() - Date.parse(lastInbound.created_at) >= 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'חלפו 24 שעות מהודעת הלקוח האחרונה. אי אפשר לשלוח הודעה חופשית; יש להתקשר או להשתמש בתבנית WhatsApp מאושרת.' }, { status: 409 });
  }

  const result = await sendWhatsAppMessage(phone, message);
  if (!result.ok) {
    await reportBotIncident('delivery_failed').catch(() => false);
    return NextResponse.json({ error: 'השליחה לא אושרה. יש לבדוק את השיחה לפני ניסיון נוסף.', code: result.outcome === 'uncertain' ? 'delivery_uncertain' : 'delivery_failed' }, { status: result.outcome === 'uncertain' ? 409 : 502 });
  }

  let historySynced = true;
  try {
    await logWhatsAppMessage({ phone, source: 'human_reply', body: message, waMessageId: result.waMessageId });
  } catch {
    historySynced = false;
    await reportBotIncident('processing_failed').catch(() => false);
  }
  // Provider acceptance must not become a generic failure inviting duplicate send.
  return NextResponse.json({ data: { ok: true, historySynced, messageId: result.waMessageId } });
}
