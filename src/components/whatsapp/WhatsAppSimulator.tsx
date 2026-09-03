'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, RotateCcw, Send, ShieldCheck, Sparkles } from 'lucide-react';

type Message = { from: 'customer' | 'bot'; body: string; warning?: boolean; error?: boolean };
type QuickReply = { label: string; message: string };
type FlowState = {
  step: string;
  locale: 'he' | 'en';
  handedOff?: boolean;
  lastQuestion?: string;
  pickupDate?: string;
  dropoffDate?: string;
  pickupTime?: string;
  returnTime?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  vehiclePreference?: string;
  carSale?: { mode?: string; selectedCarIds?: string[]; budget?: number };
} | null;

const initial: Message[] = [{
  from: 'bot',
  body: 'ברוכים הבאים ל־SmartCar 👋\n\nאפשר לכתוב לנו חופשי — גם משפט חלקי או מבולגן. נבין אם מדובר בהשכרה, הזמנה קיימת, ליסינג, רכישת רכב או עזרה בדרך, ונשאל רק את הדבר הבא שחסר.',
}];

const initialReplies: QuickReply[] = [
  { label: 'השכרת רכב', message: '1' },
  { label: 'בירור הזמנה קיימת', message: '2' },
  { label: 'ליסינג או רכישה', message: '3' },
  { label: 'תאונה, פנצ׳ר או תקלה', message: '6' },
  { label: 'English', message: 'English' },
];

function newSessionId() {
  return `sim_${crypto.randomUUID().replace(/-/g, '')}`;
}

function conversationStatus(state: FlowState) {
  if (!state) return { label: 'אפשר להתחיל בכל נושא', detail: 'בחירת התחלה מהירה או הודעה חופשית', tone: 'neutral' as const };
  if (state.handedOff) return { label: state.locale === 'en' ? 'Representative context prepared' : 'ההקשר מוכן לנציג', detail: state.locale === 'en' ? 'The simulation will not contact anyone.' : 'בסימולציה לא מתבצעת פנייה לאיש צוות.', tone: 'handoff' as const };
  if (state.lastQuestion === 'booking_lookup') return { label: state.locale === 'en' ? 'Existing booking enquiry' : 'בירור הזמנה קיימת', detail: state.locale === 'en' ? 'Waiting for a reference or full name' : 'מחכים למספר הזמנה או לשם מלא', tone: 'active' as const };
  if (state.lastQuestion === 'commercial_choice') return { label: state.locale === 'en' ? 'Commercial enquiry' : 'בירור מסחרי', detail: state.locale === 'en' ? 'Private lease, business lease, or a listed car' : 'ליסינג פרטי, ליסינג עסקי או רכב מהקטלוג', tone: 'active' as const };
  if (state.carSale?.mode === 'car_sale') return { label: state.locale === 'en' ? 'Cars for sale' : 'רכבים למכירה', detail: state.locale === 'en' ? 'Only verified catalogue details are shown' : 'מוצגים רק פרטי קטלוג מאומתים', tone: 'active' as const };

  const steps: Record<string, { he: string; en: string }> = {
    rental_dates: { he: 'מתאמים תאריכים', en: 'Collecting dates' },
    rental_times: { he: 'מתאמים שעות', en: 'Collecting times' },
    rental_locations: { he: 'מתאמים מיקומים', en: 'Collecting locations' },
    rental_vehicle: { he: 'מתאימים קטגוריית רכב', en: 'Choosing a vehicle category' },
    rental_name: { he: 'מסכמים בקשת השכרה', en: 'Preparing the rental request' },
    rental_email: { he: 'מסכמים בקשת השכרה', en: 'Preparing the rental request' },
    rental_confirm: { he: 'בודקים את פרטי הבקשה', en: 'Reviewing the request' },
  };
  const copy = steps[state.step];
  return copy
    ? { label: state.locale === 'en' ? copy.en : copy.he, detail: state.locale === 'en' ? 'You can add details in any order.' : 'אפשר להוסיף פרטים בכל סדר.', tone: 'active' as const }
    : { label: state.locale === 'en' ? 'Ready to help' : 'מוכנים לעזור', detail: state.locale === 'en' ? 'Write naturally.' : 'כתבו חופשי.', tone: 'neutral' as const };
}

export default function WhatsAppSimulator() {
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
      const response = await fetch('/api/whatsapp/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, state: flowState }),
      });
      const data = await response.json().catch(() => null) as { reply?: string; escalated?: boolean; quickReplies?: QuickReply[]; state?: FlowState } | null;
      if (!response.ok || !data) throw new Error('Simulation response unavailable');
      if (requestVersion !== resetVersion.current) return;
      setMessages((current) => [...current, {
        from: 'bot',
        body: data.reply || 'לא התקבלה תשובה. אפשר לנסות שוב.',
        warning: data.escalated,
      }]);
      setQuickReplies(data.quickReplies ?? []);
      setFlowState(data.state ?? null);
    } catch {
      if (requestVersion === resetVersion.current) {
        setMessages((current) => [...current, { from: 'bot', body: 'הסימולציה אינה זמינה כרגע. אפשר לנסות שוב בעוד רגע.', error: true }]);
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#e8fff0,_#efeae2_38%,_#e6eef0)] px-3 py-6 sm:px-6" dir="rtl">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-[#075e54]/15 bg-white shadow-[0_24px_70px_rgba(7,94,84,0.18)]">
        <header className="relative overflow-hidden bg-[#075e54] px-5 py-4 text-white">
          <div className="absolute -left-8 -top-10 h-36 w-36 rounded-full bg-[#25d366]/15 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Bot className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0">
                <h1 className="font-semibold tracking-tight">SmartCar</h1>
                <p className="flex items-center gap-1.5 text-xs text-white/80"><span className="h-2 w-2 rounded-full bg-[#79f2a3]" aria-hidden="true" />עוזר שירות ומכירה — סימולציה</p>
              </div>
            </div>
            <button type="button" onClick={reset} className="rounded-full border border-white/15 bg-white/10 p-2.5 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white" aria-label="איפוס שיחה" title="איפוס שיחה">
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="border-b border-[#075e54]/10 bg-[#f7fbf9] px-4 py-3" aria-label="מצב השיחה">
          <div className="flex items-start gap-2.5">
            {status.tone === 'handoff' ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" aria-hidden="true" /> : status.tone === 'active' ? <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#0c7a64]" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0c7a64]" aria-hidden="true" />}
            <div className="min-w-0 text-xs leading-5">
              <p className="font-semibold text-[#075e54]">{status.label}</p>
              <p className="text-slate-600">{status.detail}</p>
            </div>
          </div>
        </section>

        <section className="h-[min(66vh,580px)] min-h-[430px] space-y-3 overflow-y-auto overscroll-contain bg-[#efeae2] p-4" aria-live="polite" aria-busy={sending} aria-label="שיחת WhatsApp לדוגמה" role="log">
          <div className="mx-auto w-fit rounded-full border border-[#075e54]/10 bg-white/90 px-3 py-1.5 text-center text-xs font-medium text-slate-600 shadow-sm">סביבת ניסיון בלבד — לא נשלחת הודעה ל־WhatsApp ולא נשמרים פרטים</div>
          <div className="mx-auto w-fit rounded-md bg-[#d7e6e1]/70 px-2.5 py-1 text-[11px] font-medium text-slate-500">היום</div>
          {messages.map((message, index) => (
            <div key={`${index}-${message.from}`} className={`flex ${message.from === 'customer' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ring-1 ${message.from === 'customer'
                ? 'rounded-tr-sm bg-white text-slate-800 ring-black/5'
                : message.error ? 'rounded-tl-sm bg-red-50 text-red-950 ring-red-200' : 'rounded-tl-sm bg-[#d9fdd3] text-slate-800 ring-[#bceab8]'}`}>
                {message.warning && <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-orange-800"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> הועבר לנציג</span>}
                {message.error && <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-800">בעיה זמנית בסימולציה</span>}
                {message.body}
                <span className="mt-1 block text-left text-[10px] text-slate-400">עכשיו</span>
              </div>
            </div>
          ))}
          {sending && <div className="flex justify-end"><div className="rounded-2xl rounded-tl-sm bg-[#d9fdd3] px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-[#bceab8]"><span className="inline-flex items-center gap-1" aria-label="SmartCar כותב"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0c7a64]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0c7a64] [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0c7a64] [animation-delay:300ms]" /></span></div></div>}
          {!sending && quickReplies.length > 0 && (
            <div className="pt-2" aria-label="אפשרויות מהירות">
              <p className="mb-2 text-xs font-medium text-slate-500">אפשר להתחיל בלחיצה:</p>
              <div className="flex flex-wrap justify-start gap-2">
                {quickReplies.map((option) => (
                  <button
                    key={`${option.label}-${option.message}`}
                    type="button"
                    onClick={() => send(undefined, option.message, option.label)}
                    className="rounded-full border border-[#25d366]/70 bg-white px-3.5 py-2 text-sm font-semibold text-[#075e54] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#e8fff0] focus:outline-none focus:ring-2 focus:ring-[#25d366]"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={endOfConversation} />
        </section>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-black/5 bg-[#f0f2f5] p-3" dir="rtl" aria-label="שליחת הודעה לסימולציה">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} placeholder={flowState?.locale === 'en' ? 'Type a message to SmartCar' : 'כתבו הודעה ל־SmartCar'} className="min-w-0 flex-1 rounded-full border-0 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-black/10 transition placeholder:text-slate-400 focus:ring-2 focus:ring-[#25d366] disabled:cursor-not-allowed disabled:bg-slate-100" />
          <button type="submit" disabled={!draft.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white shadow-sm transition hover:bg-[#1fbd5b] focus:outline-none focus:ring-2 focus:ring-[#075e54] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40" aria-label="שליחה">
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      </div>
    </main>
  );
}
