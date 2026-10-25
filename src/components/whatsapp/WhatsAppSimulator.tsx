'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CarFront, RotateCcw, Send, ShieldCheck } from 'lucide-react';

type Message = { from: 'customer' | 'bot'; body: string; warning?: boolean; error?: boolean };
type QuickReply = { label: string; message: string };
type FlowState = {
  version: 2;
  phase: 'explore' | 'booking' | 'service';
  step: string;
  locale: 'he' | 'en';
  handedOff?: boolean;
  interest?: 'leasing' | 'sale';
} | null;

const initial: Message[] = [{
  from: 'bot',
  body: 'שלום, הגעתם ל־SmartCar 👋\nאיך אפשר לעזור? אפשר לשאול על השכרה, הזמנה קיימת, ליסינג, רכישת רכב או עזרה בדרך.',
}];

const initialReplies: QuickReply[] = [
  { label: 'השכרת רכב', message: 'אני מחפש רכב להשכרה, מה כדאי לבדוק?' },
  { label: 'הזמנה קיימת', message: 'יש לי הזמנה קיימת ואני צריך עזרה' },
  { label: 'ליסינג', message: 'אני מתעניין בליסינג' },
  { label: 'רכישת רכב', message: 'אני מחפש רכב לקנייה' },
  { label: 'עזרה בדרך', message: 'שכרתי רכב ויש תקלה, אני צריך עזרה בדרך' },
  { label: 'English', message: 'English' },
];

function newSessionId() {
  return `sim_${crypto.randomUUID().replace(/-/g, '')}`;
}

function conversationStatus(state: FlowState) {
  if (!state) return { label: 'אפשר להתחיל בכל נושא', detail: 'בחירת התחלה מהירה או הודעה חופשית', tone: 'neutral' as const };
  if (state.handedOff) return { label: state.locale === 'en' ? 'Representative context prepared' : 'ההקשר מוכן לנציג', detail: state.locale === 'en' ? 'The simulation will not contact anyone.' : 'בסימולציה לא מתבצעת פנייה לאיש צוות.', tone: 'handoff' as const };
  if (state.phase === 'service') return { label: state.locale === 'en' ? 'Service enquiry' : 'פניית שירות', detail: state.locale === 'en' ? 'Specific changes need team review.' : 'שינויים מסוימים דורשים בדיקת צוות.', tone: 'active' as const };
  if (state.interest) return { label: state.locale === 'en' ? 'Commercial enquiry' : 'בירור מסחרי', detail: state.locale === 'en' ? 'The team checks leasing and sale offers.' : 'הצעות ליסינג ומכירה נבדקות מול הצוות.', tone: 'active' as const };

  const steps: Record<string, { he: string; en: string }> = {
    rental_dates: { he: 'מתאמים תאריכים', en: 'Collecting dates' },
    rental_locations: { he: 'מתאמים מיקומים', en: 'Collecting locations' },
    rental_vehicle: { he: 'מתאימים קטגוריית רכב', en: 'Choosing a vehicle category' },
    rental_age: { he: 'בודקים את קבוצת גיל הנהג', en: 'Checking the driver age group' },
    rental_name: { he: 'מסכמים בקשת השכרה', en: 'Preparing the rental request' },
    rental_email: { he: 'מסכמים בקשת השכרה', en: 'Preparing the rental request' },
    rental_confirm: { he: 'בודקים את פרטי הבקשה', en: 'Reviewing the request' },
  };
  const copy = steps[state.step];
  return copy
    ? { label: state.locale === 'en' ? copy.en : copy.he, detail: state.locale === 'en' ? 'You can add details in any order.' : 'אפשר להוסיף פרטים בכל סדר.', tone: 'active' as const }
    : { label: state.locale === 'en' ? 'Ready to help' : 'מוכנים לעזור', detail: state.locale === 'en' ? 'Write naturally.' : 'כתבו חופשי.', tone: 'neutral' as const };
}

export default function WhatsAppSimulator({ endpoint = '/api/whatsapp/simulator', title = 'SmartCar' }: { endpoint?: string; title?: string }) {
  const sessionId = useRef(newSessionId()).current;
  const endOfConversation = useRef<HTMLDivElement>(null);
  const resetVersion = useRef(0);
  const [messages, setMessages] = useState<Message[]>(initial);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(initialReplies);
  const [flowState, setFlowState] = useState<FlowState>(null);
  const status = useMemo(() => conversationStatus(flowState), [flowState]);

  useEffect(() => {
    endOfConversation.current?.scrollIntoView({ block: 'end', behavior: messages.length > 1 ? 'smooth' : 'auto' });
  }, [messages, quickReplies, sending]);

  async function send(event?: FormEvent, selectedMessage?: string, displayMessage?: string) {
    event?.preventDefault();
    const message = (selectedMessage ?? draft).trim();
    if (!message || sending) return;

    const requestVersion = resetVersion.current;
    setDraft('');
    setQuickReplies([]);
    setMessages((current) => [...current, { from: 'customer', body: displayMessage ?? message }]);
    setSending(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, state: flowState }),
      });
      const data = await response.json().catch(() => null) as { reply?: string; escalated?: boolean; quickReplies?: QuickReply[]; state?: FlowState } | null;
      if (response.status === 429) throw new Error('simulation-limit');
      if (!response.ok || !data) throw new Error('Simulation response unavailable');
      if (requestVersion !== resetVersion.current) return;
      setMessages((current) => [...current, {
        from: 'bot',
        body: data.reply || 'לא התקבלה תשובה. אפשר לנסות שוב.',
        warning: data.escalated,
      }]);
      setQuickReplies(data.quickReplies ?? []);
      setFlowState(data.state ?? null);
    } catch (error) {
      if (requestVersion === resetVersion.current) {
        setMessages((current) => [...current, { from: 'bot', body: error instanceof Error && error.message === 'simulation-limit' ? 'הגעתם למכסת הודעות הבדיקה של הסימולציה. אפשר לנסות שוב בהמשך.' : 'הסימולציה אינה זמינה כרגע. אפשר לנסות שוב בעוד רגע.', error: true }]);
      }
    } finally {
      if (requestVersion === resetVersion.current) setSending(false);
    }
  }

  function reset() {
    resetVersion.current += 1;
    setMessages(initial);
    setDraft('');
    setSending(false);
    setQuickReplies(initialReplies);
    setFlowState(null);
  }

  return (
    <main className="h-[100dvh] bg-[#F5F0E8] p-0 sm:p-5" dir="rtl">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden bg-[#FCFBF8] sm:rounded-[1.5rem] sm:border sm:border-[#0D2B2B]/10 sm:shadow-[0_20px_55px_rgba(13,43,43,0.12)]">
        <header className="shrink-0 bg-[#0D2B2B] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white sm:px-6 sm:py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B8D8D8] text-[#0D2B2B]"><CarFront className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight">{title}<span className="ms-2 rounded-full bg-[#E8743B] px-2 py-0.5 align-middle text-[10px] font-semibold text-white">הדגמה</span></h1>
                <p className="truncate text-xs text-[#B8D8D8]">{status.label}</p>
              </div>
            </div>
            <button type="button" onClick={reset} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#B8D8D8] transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#B8D8D8]" aria-label="איפוס שיחה" title="איפוס שיחה">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#F8F7F3] px-3 py-4 sm:px-7 sm:py-5" aria-live="polite" aria-busy={sending} aria-label="שיחת WhatsApp לדוגמה" role="log">
          <p className="mx-auto max-w-xl text-center text-[11px] leading-5 text-[#5B6B68]">סביבת ניסיון בלבד. לא נשלחות הודעות ולא נוצרות הזמנות. הודעות חופשיות עשויות להישלח ל־Google Gemini להבנת הבקשה; השתמשו בפרטים מומצאים.</p>
          {messages.map((message, index) => (
            <div key={`${index}-${message.from}`} className={`flex ${message.from === 'customer' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-[1rem] px-3.5 py-2.5 text-sm leading-[1.65] ring-1 sm:max-w-[75%] ${message.from === 'customer'
                ? 'rounded-tr-sm bg-white text-[#0D2B2B] ring-[#0D2B2B]/10'
                : message.error ? 'rounded-tl-sm bg-[#FFF2ED] text-[#8D3113] ring-[#E8743B]/25' : 'rounded-tl-sm bg-[#E5F0EE] text-[#0D2B2B] ring-[#B8D8D8]'}`}>
                {message.warning && <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#A9471E]"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> נדרש טיפול נציג</span>}
                {message.error && <span className="mb-1 block text-xs font-semibold">בעיה זמנית בסימולציה</span>}
                {message.body}
              </div>
            </div>
          ))}
          {sending && <div className="flex justify-end"><div className="rounded-2xl rounded-tl-sm bg-[#E5F0EE] px-4 py-3 text-sm text-[#2D5F5F] ring-1 ring-[#B8D8D8]"><span className="inline-flex items-center gap-1" aria-label="SmartCar כותב"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2D5F5F]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2D5F5F] [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2D5F5F] [animation-delay:300ms]" /></span></div></div>}
          {!sending && quickReplies.length > 0 && (
            <div className="pt-2" aria-label="אפשרויות מהירות">
              <p className="mb-2 text-xs font-medium text-[#5B6B68]">אפשר להתחיל מכאן</p>
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((option) => (
                  <button key={`${option.label}-${option.message}`} type="button" onClick={() => send(undefined, option.message, option.label)} className="min-h-10 rounded-xl border border-[#B8D8D8] bg-white px-3.5 py-2 text-sm font-medium text-[#0D2B2B] transition hover:border-[#2D5F5F] hover:bg-[#EEF6F6] focus:outline-none focus:ring-2 focus:ring-[#2D5F5F]">
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={endOfConversation} />
        </section>

        <form onSubmit={send} className="flex shrink-0 items-center gap-2 border-t border-[#0D2B2B]/10 bg-[#FCFBF8] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5" dir="rtl" aria-label="שליחת הודעה לסימולציה">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} placeholder={flowState?.locale === 'en' ? 'Type a message to SmartCar' : 'כתבו הודעה ל־SmartCar'} className="min-w-0 flex-1 rounded-xl border border-[#0D2B2B]/15 bg-white px-4 py-2.5 text-base text-[#0D2B2B] outline-none transition placeholder:text-[#7A8B87] focus:border-[#2D5F5F] focus:ring-2 focus:ring-[#B8D8D8] disabled:cursor-not-allowed disabled:bg-slate-100" />
          <button type="submit" disabled={!draft.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8743B] text-white transition hover:bg-[#C65E2D] focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40" aria-label="שליחה">
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </main>
  );
}
