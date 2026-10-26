import { createAdminClient } from '@/lib/supabase/server';
import type { SendWhatsAppResult } from '@/lib/whatsapp';

type Claim = { action: 'prepare' | 'send' | 'busy' | 'done' | 'uncertain' | 'accepted'; reply: string | null; escalate: boolean; providerReplyId: string | null };

export async function claimInboundMessage(messageId: string, phone: string): Promise<Claim> {
  const { data, error } = await createAdminClient().rpc('claim_whatsapp_inbound', {
    p_message_id: messageId, p_phone: phone,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || !['prepare', 'send', 'busy', 'done', 'uncertain', 'accepted'].includes(row.action)) {
    throw new Error('[whatsapp] could not claim inbound message');
  }
  if (row.action === 'send' && (!row.saved_reply || typeof row.saved_reply !== 'string')) {
    throw new Error('[whatsapp] prepared reply missing');
  }
  if (row.action === 'accepted' && (!row.saved_reply || !row.saved_provider_reply_id)) {
    throw new Error('[whatsapp] accepted reply lacks reconciliation data');
  }
  return { action: row.action, reply: row.saved_reply ?? null, escalate: row.should_escalate === true, providerReplyId: row.saved_provider_reply_id ?? null };
}

export async function prepareInboundReply(messageId: string, reply: string, escalate: boolean): Promise<void> {
  const { data, error } = await createAdminClient().from('whatsapp_inbound_journal')
    .update({ status: reply ? 'prepared' : 'suppressed', reply_body: reply || null, escalate, lease_until: null, updated_at: new Date().toISOString() })
    .eq('message_id', messageId).eq('status', 'preparing').select('message_id').maybeSingle();
  if (error || !data) throw new Error('[whatsapp] could not persist prepared reply');
}

export async function suppressInboundWhileOff(messageId: string, phone: string): Promise<void> {
  const { error } = await createAdminClient().from('whatsapp_inbound_journal')
    .upsert({ message_id: messageId, phone, status: 'suppressed' }, { onConflict: 'message_id', ignoreDuplicates: true });
  if (error) throw new Error('[whatsapp] could not mark disabled inbound message');
}

export async function suppressClaimedSend(messageId: string): Promise<void> {
  const { data, error } = await createAdminClient().from('whatsapp_inbound_journal')
    .update({ status: 'suppressed', lease_until: null, updated_at: new Date().toISOString() })
    .eq('message_id', messageId).eq('status', 'sending').select('message_id').maybeSingle();
  if (error || !data) throw new Error('[whatsapp] could not stop claimed reply');
}

export async function recordInboundSend(messageId: string, result: SendWhatsAppResult): Promise<void> {
  const status = result.ok ? 'accepted' : result.outcome === 'uncertain' ? 'uncertain' : 'rejected';
  const { data, error } = await createAdminClient().from('whatsapp_inbound_journal')
    .update({ status, provider_reply_id: result.waMessageId, lease_until: null, updated_at: new Date().toISOString() })
    .eq('message_id', messageId).eq('status', 'sending').select('message_id').maybeSingle();
  if (error || !data) throw new Error('[whatsapp] could not persist provider outcome');
}
