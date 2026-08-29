import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken, verifyInboxToken } from '@/lib/admin-auth';

/**
 * Cheapest-possible test of the agent-inbox concept (see the plan) — no
 * PWA, no push, just a list + thread inside the existing admin panel so
 * Daniel can try working conversations from a browser for a couple of days
 * before Ido commits to the full PWA + number migration.
 *
 * Accepts either the full admin session or Daniel's scoped inbox PIN
 * (src/app/api/admin/whatsapp/inbox-login) — the PIN session opens only
 * this surface, never bookings/leasing/pricing.
 */

async function checkAuth() {
  const cookieStore = await cookies();
  const adminOk = await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
  if (adminOk) return true;
  return verifyInboxToken(cookieStore.get('inbox_auth')?.value ?? '');
}

interface MessageRow {
  phone: string;
  body: string;
  source: string;
  created_at: string;
  escalated_at: string | null;
}

interface ConversationSummary {
  phone: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSource: string;
  escalated: boolean;
}

/** Rows must already be ordered created_at desc. */
function summarize(rows: MessageRow[]): ConversationSummary[] {
  const byPhone = new Map<string, MessageRow[]>();
  for (const row of rows) {
    const list = byPhone.get(row.phone) ?? [];
    list.push(row);
    byPhone.set(row.phone, list);
  }

  const summaries: ConversationSummary[] = [];
  for (const [phone, list] of byPhone) {
    // Walking newest-first: a human reply means the conversation is
    // resolved even if an earlier escalation is still in the window; an
    // escalated_at hit before any human reply means it's still open.
    let escalated = false;
    for (const row of list) {
      if (row.source === 'human_reply') break;
      if (row.escalated_at) {
        escalated = true;
        break;
      }
    }
    const latest = list[0];
    summaries.push({
      phone,
      lastMessage: latest.body,
      lastMessageAt: latest.created_at,
      lastSource: latest.source,
      escalated,
    });
  }

  return summaries.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
}

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('phone, body, source, created_at, escalated_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[admin/whatsapp/conversations]', error.message);
    return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 });
  }

  return NextResponse.json({ data: summarize((data ?? []) as MessageRow[]) });
}
