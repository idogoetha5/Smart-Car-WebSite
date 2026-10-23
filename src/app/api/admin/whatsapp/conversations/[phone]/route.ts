import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken, verifyInboxToken } from '@/lib/admin-auth';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
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
  const validCursor = (value: string | null) => value === null || (/^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value)));
  if (!/^\+?\d{9,15}$/.test(phone) || !validCursor(before) || !validCursor(after) || (before && after)) {
    return NextResponse.json({ error: 'Invalid conversation cursor' }, { status: 400 });
  }

  const supabase = createAdminClient();
  let query = supabase
    .from('whatsapp_messages')
    .select('id, source, body, created_at, escalated_at')
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
  return NextResponse.json({ data: { ok: true, historySynced } });
}
