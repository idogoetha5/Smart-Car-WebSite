import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Scoped to SmartCar rental topics only — not a general-purpose assistant.
 * Meta's WhatsApp Business Solution terms (effective 2026-01-15) prohibit
 * general-purpose AI assistants as the primary product on the API, but
 * permit a business running a scoped customer-service bot for its own
 * operations. Off-topic requests get declined/escalated, not answered.
 */
const SYSTEM_PROMPT = `אתה עוזר שירות לקוחות של סמארטקאר, חברת השכרת רכב בישראל. אתה עונה ללקוחות בוואטסאפ בעברית, בטון ידידותי ומקצועי.

תחומי האחריות שלך: זמינות רכבים, מחירים, מיקומי איסוף והחזרה, סטטוס הזמנה קיימת, שאלות כלליות על תהליך ההשכרה. אינך עוזר כללי — אינך עונה על שאלות שאינן קשורות לסמארטקאר או להשכרת רכב.

כאשר אתה מזהה אחד מהמצבים הבאים, סמן escalate=true ותן תשובה קצרה שמודיעה ללקוח שנציג יחזור אליו בהקדם:
- הלקוח מבקש באופן מפורש לדבר עם נציג/אדם
- אינך בטוח שהתשובה שלך נכונה
- הנושא נוגע לחריגה במחיר, נזק/תאונה, החזר כספי, או כל נושא משפטי
- הלקוח שואל שוב את אותה שאלה אחרי שכבר ענית עליה
- ההודעה של הלקוח נשמעת כועסת או מתוסכלת
- הבקשה אינה קשורה לסמארטקאר או להשכרת רכב

אם יש לך מידע אמיתי על הזמנה של הלקוח (סטטוס, תאריכים), התבסס עליו ואל תמציא פרטים. אם אין הזמנה מתאימה, אל תניח שיש.`;

interface BookingContext {
  id: string;
  status: string;
  pickup_date: string;
  dropoff_date: string;
  pickup_location: string;
  dropoff_location: string;
  vehicle: { make: string | null; model: string | null } | null;
}

const ReplySchema = z.object({
  reply: z.string().describe('The Hebrew reply to send the customer.'),
  escalate: z.boolean().describe('True if a human must take over this conversation.'),
  escalate_reason: z
    .string()
    .optional()
    .describe('Short reason for escalation, in Hebrew. Omit when escalate is false.'),
});

export interface WhatsAppAiResult {
  reply: string;
  escalate: boolean;
  escalateReason?: string;
}

async function findBookingsForPhone(phoneDigits: string): Promise<BookingContext[]> {
  // Stored customer_phone formatting is inconsistent (local vs. international,
  // with/without dashes), so match on the last 9 digits — the Israeli mobile
  // local number, unambiguous regardless of country-code/leading-zero prefix.
  const localSuffix = phoneDigits.slice(-9);
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('bookings')
    .select('id, status, pickup_date, dropoff_date, pickup_location, dropoff_location, vehicle:vehicles(make, model), customer_phone')
    .ilike('customer_phone', `%${localSuffix}%`)
    .order('created_at', { ascending: false })
    .limit(3);

  return ((data ?? []) as unknown as (BookingContext & { customer_phone: string })[]).map(
    ({ customer_phone: _customerPhone, ...rest }) => rest
  );
}

/** Last N turns for this phone, oldest first, formatted for the model. */
async function recentHistory(phone: string, limit = 12): Promise<Anthropic.MessageParam[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('source, body, created_at')
    .eq('phone', phone)
    .neq('source', 'human_echo')
    .order('created_at', { ascending: false })
    .limit(limit);

  return ((data ?? []) as { source: string; body: string }[])
    .reverse()
    .map((row) => ({
      role: row.source === 'customer_inbound' ? 'user' : 'assistant',
      content: row.body,
    }));
}

export async function getWhatsAppAiReply(phone: string, incomingMessage: string): Promise<WhatsAppAiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[whatsapp-ai] ANTHROPIC_API_KEY is not configured');
    return {
      reply: 'מצטערים, יש לנו תקלה זמנית. נציג יחזור אליכם בהקדם.',
      escalate: true,
      escalateReason: 'ANTHROPIC_API_KEY not configured',
    };
  }

  const client = new Anthropic({ apiKey });
  const bookings = await findBookingsForPhone(phone);
  const history = await recentHistory(phone);

  const bookingContext = bookings.length
    ? `הזמנות קיימות של הלקוח:\n${bookings
        .map(
          (b) =>
            `- הזמנה ${b.id}: ${b.vehicle?.make ?? ''} ${b.vehicle?.model ?? ''}, סטטוס ${b.status}, איסוף ${b.pickup_date} מ-${b.pickup_location}, החזרה ${b.dropoff_date} ב-${b.dropoff_location}`
        )
        .join('\n')}`
    : 'ללקוח הזה אין הזמנה קיימת במערכת שמתאימה למספר הטלפון שלו.';

  const response = await client.messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    // Stable across every conversation, so it's the cached block; the
    // per-customer booking context varies per request and stays uncached,
    // after it in render order.
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: bookingContext },
    ],
    // No `effort` here — it 400s on Haiku 4.5 (only Opus/Sonnet-tier models
    // accept it). Structured outputs are supported on Haiku 4.5.
    output_config: { format: zodOutputFormat(ReplySchema) },
    messages: [...history, { role: 'user', content: incomingMessage }],
  });

  if (!response.parsed_output) {
    console.error('[whatsapp-ai] response failed schema validation');
    return {
      reply: 'מצטערים, יש לנו תקלה זמנית. נציג יחזור אליכם בהקדם.',
      escalate: true,
      escalateReason: 'AI response failed schema validation',
    };
  }

  return {
    reply: response.parsed_output.reply,
    escalate: response.parsed_output.escalate,
    escalateReason: response.parsed_output.escalate_reason,
  };
}
