import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { logWhatsAppMessage } from '@/lib/whatsapp-conversations';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET(_request: Request, { params }: { params: Promise<{ phone: string }> }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { phone } = await params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id, source, body, created_at, escalated_at')
    .eq('phone', phone)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[admin/whatsapp/conversations/:phone]', error.message);
    return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
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
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: 'הודעה ריקה' }, { status: 400 });

  const result = await sendWhatsAppMessage(phone, message);
  if (!result.ok) {
    return NextResponse.json({ error: 'שליחה נכשלה' }, { status: 502 });
  }

  await logWhatsAppMessage({ phone, source: 'human_reply', body: message, waMessageId: result.waMessageId });

  return NextResponse.json({ data: { ok: true } });
}
