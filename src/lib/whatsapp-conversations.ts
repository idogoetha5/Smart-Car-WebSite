import { createAdminClient } from '@/lib/supabase/server';

/**
 * Shared read/write helpers for `whatsapp_messages`, used by both the
 * inbound webhook (src/app/api/whatsapp/webhook/route.ts) and the agent
 * inbox's reply endpoint (src/app/api/admin/whatsapp/conversations/[phone]/reply,
 * once built — see the plan for the PWA inbox that replaces Daniel's phone
 * app). `human_reply` covers any message a staff member sends to the
 * customer, regardless of which surface it came from.
 */

export type MessageSource = 'customer_inbound' | 'bot_outbound' | 'human_reply';

const SILENCE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Returns true if this insert was new (not a duplicate delivery). Callers
 * that only care about idempotency check the return value; callers logging
 * a send they already know succeeded (bot replies, human replies) can
 * ignore it.
 */
export async function logWhatsAppMessage(params: {
  phone: string;
  source: MessageSource;
  body: string;
  waMessageId?: string | null;
  escalatedAt?: string | null;
}): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .upsert(
      {
        phone: params.phone,
        source: params.source,
        body: params.body,
        wa_message_id: params.waMessageId ?? null,
        escalated_at: params.escalatedAt ?? null,
      },
      { onConflict: 'wa_message_id', ignoreDuplicates: true }
    )
    .select('id');

  if (error) {
    console.error('[whatsapp][ALERT] failed to log message:', error.message);
    return false;
  }
  // ignoreDuplicates: an empty result means the wa_message_id already existed —
  // this delivery is a provider retry of one we already processed.
  return (data?.length ?? 0) > 0;
}

/**
 * True when a human has taken this conversation over in the last 24h —
 * either by replying (from the agent inbox) or via an AI escalation. The
 * bot stays silent in that conversation until the window lapses.
 */
export async function isConversationSilenced(phone: string): Promise<boolean> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - SILENCE_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('source, created_at, escalated_at')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(20);

  for (const row of (data ?? []) as { source: string; created_at: string; escalated_at: string | null }[]) {
    if (row.source === 'human_reply' && row.created_at > cutoff) return true;
    if (row.escalated_at && row.escalated_at > cutoff) return true;
  }
  return false;
}
