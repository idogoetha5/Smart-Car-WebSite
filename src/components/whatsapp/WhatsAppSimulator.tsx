'use client';

import { FormEvent, useRef, useState } from 'react';
import { Send, RotateCcw, ShieldCheck } from 'lucide-react';

type Message = { from: 'customer' | 'bot'; body: string; warning?: boolean };
type QuickReply = { label: string; message: string };
type FlowState = { step: string; locale: 'he' | 'en' } | null;

const initial: Message[] = [{
  from: 'bot',
  body: 'ברוכים הבאים לסימולציית SmartCar 👋\n\nכתבו לנו חופשי בדיוק כפי שהייתם כותבים ל־SmartCar ב־WhatsApp.',
}];

const initialReplies: QuickReply[] = [
  { label: 'השכרת רכב', message: '1' },
  { label: 'בירור הזמנה קיימת', message: '2' },
  { label: 'ליסינג או רכישה', message: '3' },
  { label: 'תאונה, פנצ׳ר או תקלה', message: '6' },
  { label: 'English', message: 'English' },
];

export default function WhatsAppSimulator() {
  const sessionId = useRef(`sim_${crypto.randomUUID().replace(/-/g, '')}`).current;
  const [messages, setMessages] = useState<Message[]>(initial);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(initialReplies);
  const [flowState, setFlowState] = useState<FlowState>(null);

  async function send(event?: FormEvent, selectedMessage?: string, displayMessage?: string) {
    event?.preventDefault();
    const message = (selectedMessage ?? draft).trim();
    if (!message || sending) return;
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
      const data = await response.json() as { reply?: string; escalated?: boolean; quickReplies?: QuickReply[]; state?: FlowState };
      setMessages((current) => [...current, {
        from: 'bot',
        body: data.reply || 'לא התקבלה תשובה. נסו שוב.',
        warning: data.escalated,
      }]);
      setQuickReplies(data.quickReplies ?? []);
      setFlowState(data.state ?? null);
    } catch {
      setMessages((current) => [...current, { from: 'bot', body: 'הסימולציה אינה זמינה כרגע. נסו שוב בעוד רגע.' }]);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setMessages(initial);
    setDraft('');
    setQuickReplies(initialReplies);
    setFlowState(null);
  }

  return (
    <main className="min-h-screen bg-[#efeae2] px-3 py-6 sm:px-6" dir="rtl">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-[#075e54] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-lg font-bold">SC</div>
            <div>
              <h1 className="font-semibold">SmartCar</h1>
              <p className="text-xs text-white/75">סימולציית WhatsApp — בוט בדיקה</p>
            </div>
          </div>
          <button type="button" onClick={reset} className="rounded-full p-2 hover:bg-white/15" aria-label="איפוס שיחה">
            <RotateCcw className="h-5 w-5" />
          </button>
        </header>

        <section className="min-h-[470px] space-y-3 bg-[#efeae2] p-4" aria-live="polite">
          <div className="mx-auto w-fit rounded-lg bg-white/80 px-3 py-1 text-center text-xs text-slate-600">סביבת ניסיון בלבד — לא נשלחת הודעה ל־WhatsApp</div>
          {messages.map((message, index) => (
            <div key={`${index}-${message.from}`} className={`flex ${message.from === 'customer' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.from === 'customer' ? 'rounded-tr-sm bg-white text-slate-800' : 'rounded-tl-sm bg-[#d9fdd3] text-slate-800'}`}>
                {message.warning && <span className="mb-1 flex items-center gap-1 text-xs font-medium text-orange-700"><ShieldCheck className="h-3.5 w-3.5" /> הועבר לנציג</span>}
                {message.body}
              </div>
            </div>
          ))}
          {sending && <div className="flex justify-end"><div className="rounded-2xl rounded-tl-sm bg-[#d9fdd3] px-4 py-3 text-sm text-slate-500">כותב…</div></div>}
          {!sending && quickReplies.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2 pt-1" aria-label="אפשרויות מהירות">
              {quickReplies.map((option) => (
                <button
                  key={`${option.label}-${option.message}`}
                  type="button"
                  onClick={() => send(undefined, option.message, option.label)}
                  className="rounded-full border border-[#25d366] bg-white px-3 py-2 text-sm font-medium text-[#075e54] shadow-sm transition hover:bg-[#e8fff0]"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={send} className="flex items-center gap-2 border-t bg-[#f0f2f5] p-3" dir="rtl">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={flowState?.locale === 'en' ? 'Type a message to SmartCar' : 'כתבו הודעה ל־SmartCar'} className="min-w-0 flex-1 rounded-full border-0 bg-white px-4 py-3 text-sm outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-[#25d366]" />
          <button type="submit" disabled={!draft.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white disabled:opacity-40" aria-label="שליחה">
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </main>
  );
}
