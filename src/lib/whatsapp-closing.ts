import { createAdminClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { CONVERSATION_MEMORY_MS, type FlowState } from '@/lib/whatsapp-flow';

/** Half an hour before the bot forgets a conversation, it says so once. */
export const CLOSING_NOTICE_BEFORE_MS = 30 * 60 * 1000;

export function closingNotice(locale: 'he' | 'en' | undefined) {
  return locale === 'en'
    ? 'Hi again 🙂 Just a heads-up: in about half an hour this chat will close and I’ll clear the details you shared. Want to carry on? Just send me anything here and we’ll pick up exactly where we left off.'
    : 'היי, שוב אני 🙂 רק שתדע/י — בעוד כחצי שעה השיחה שלנו תיסגר והפרטים שמסרת יימחקו אצלי. רוצה להמשיך? פשוט שלח/י כאן הודעה ונמשיך בדיוק מאיפה שעצרנו.';
}

type Row = { phone: string; state: FlowState; updated_at: string };

/**
 * Sends the closing notice to every conversation that has been quiet for
 * 11.5 hours and has not had one yet. Conversations a person has taken over
 * are left to that person. Marking the notice does not touch updated_at, so
 * it does not extend the 12 hours.
 */
export async function sendClosingNotices(now = Date.now()) {
  const supabase = createAdminClient();
  const from = new Date(now - CONVERSATION_MEMORY_MS).toISOString();
  const to = new Date(now - (CONVERSATION_MEMORY_MS - CLOSING_NOTICE_BEFORE_MS)).toISOString();
  const { data, error } = await supabase
    .from('whatsapp_conversation_states')
    .select('phone, state, updated_at')
    .gt('updated_at', from)
    .lte('updated_at', to)
    .limit(200);
  if (error) throw new Error(`[whatsapp-closing] failed to load conversations: ${error.message}`);

  let sent = 0;
  for (const row of (data ?? []) as Row[]) {
    if (!row.state || row.state.closingNoticeSentAt || row.state.handedOff) continue;
    const result = await sendWhatsAppMessage(row.phone, closingNotice(row.state.locale));
    if (!result.ok) continue;
    const { error: markError } = await supabase
      .from('whatsapp_conversation_states')
      .update({ state: { ...row.state, closingNoticeSentAt: new Date(now).toISOString() } })
      .eq('phone', row.phone)
      .eq('updated_at', row.updated_at);
    if (markError) console.error('[whatsapp-closing] failed to mark notice:', markError.message);
    sent += 1;
  }
  return { checked: data?.length ?? 0, sent };
}
