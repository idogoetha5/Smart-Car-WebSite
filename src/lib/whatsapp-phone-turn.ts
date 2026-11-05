import { createAdminClient } from '@/lib/supabase/server';

export type PhoneTurnClaim = {
  action: 'prepare' | 'prepared' | 'send' | 'busy' | 'done' | 'uncertain' | 'accepted' | 'manual';
  reply: string | null;
  escalate: boolean;
  providerReplyId: string | null;
};
export type PhoneTurn = {
  phone: string;
  messageId: string;
  ownerToken: string | null;
  sendAttemptToken: string | null;
  claim: PhoneTurnClaim;
  lost: boolean;
  manualEventId: string | null;
};

/** Mutations and ownership validation happen atomically in the database RPC. */
export async function mutatePhoneTurn(turn: PhoneTurn, kind: 'assert' | 'state' | 'request' | 'handoff' | 'prepare' | 'send' | 'suppress', payload: unknown = {}): Promise<Record<string, unknown>> {
  if (!turn.ownerToken || turn.lost) throw new Error('[whatsapp] turn ownership unavailable');
  const { data, error } = await createAdminClient().rpc('mutate_whatsapp_phone_turn', {
    p_phone: turn.phone, p_message_id: turn.messageId, p_owner_token: turn.ownerToken,
    p_kind: kind, p_payload: payload,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('[whatsapp] owned mutation failed');
  return data as Record<string, unknown>;
}

/** No in-memory lock: different Vercel workers must acquire the same DB row. */
export async function withSerializedPhoneTurn<T>(phone: string, messageId: string, emergency: boolean, run: (turn: PhoneTurn) => Promise<T>): Promise<T> {
  const { data, error } = await createAdminClient().rpc('claim_whatsapp_phone_turn', {
    p_phone: phone, p_message_id: messageId, p_emergency: emergency,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || !['prepare', 'prepared', 'busy', 'done', 'uncertain', 'accepted', 'manual'].includes(row.action)) {
    throw new Error('[whatsapp] conversation claim unavailable');
  }
  if (row.action === 'busy') throw new Error('[whatsapp] conversation already processing');
  if (['prepare', 'prepared'].includes(row.action) && typeof row.turn_token !== 'string') throw new Error('[whatsapp] conversation owner missing');
  const turn: PhoneTurn = {
    phone, messageId, ownerToken: row.turn_token ?? null, sendAttemptToken: row.attempt_token ?? null,
    claim: { action: row.action, reply: row.saved_reply ?? null, escalate: row.should_escalate === true, providerReplyId: row.saved_provider_reply_id ?? null },
    lost: false, manualEventId: typeof row.manual_event_id === 'string' ? row.manual_event_id : null,
  };
  let renewal: Promise<void> | null = null;
  const timer = turn.ownerToken ? setInterval(() => {
    if (renewal || turn.lost) return;
    renewal = (async () => {
      const renewed = await createAdminClient().rpc('renew_whatsapp_phone_turn', {
        p_phone: phone, p_message_id: messageId, p_owner_token: turn.ownerToken,
      });
      if (renewed.error || renewed.data !== true) turn.lost = true;
    })().catch(() => { turn.lost = true; }).finally(() => { renewal = null; });
  }, 10_000) : null;
  timer?.unref?.();
  let failed = false;
  try { return await run(turn); }
  catch (cause) { failed = true; throw cause; }
  finally {
    if (timer) clearInterval(timer);
    if (renewal) await renewal;
    if (turn.ownerToken) {
      const released = await Promise.resolve(createAdminClient().rpc('release_whatsapp_phone_turn', {
        p_phone: phone, p_message_id: messageId, p_owner_token: turn.ownerToken,
      })).catch(() => ({ error: true }));
      // A replaced owner's release correctly returns false; it cannot clear
      // the replacement. Database failure is retried through the journal.
      if (released.error && !failed) throw new Error('[whatsapp] conversation release failed');
    }
  }
}
