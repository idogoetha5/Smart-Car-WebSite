'use client';

import { useParams, useRouter } from 'next/navigation';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import { WhatsAppThreadFeed, type ThreadMessage as Message, type ThreadPage } from '@/lib/whatsapp-thread-feed';
import { ArrowRight, Send } from 'lucide-react';


function formatPhone(phone: string): string {
  const local = phone.startsWith('972') ? '0' + phone.slice(3) : phone;
  return local.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

const BUBBLE_STYLE: Record<Message['source'], string> = {
  customer_inbound: 'bg-white border border-gray-200 self-start text-gray-900',
  bot_outbound: 'bg-blue-50 border border-blue-100 self-end text-gray-900',
  human_reply: 'bg-green-50 border border-green-100 self-end text-gray-900',
};

const SOURCE_LABEL: Record<Message['source'], string> = {
  customer_inbound: 'לקוח',
  bot_outbound: 'בוט',
  human_reply: 'את/ה',
};

export default function AdminInboxThreadPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'he';
  const phone = params?.phone as string;

  const feed = useMemo(() => new WhatsAppThreadFeed(`/api/admin/whatsapp/conversations/${encodeURIComponent(phone ?? '')}`, fetcher<ThreadPage>), [phone]);
  const { data, error, isLoading, mutate } = useSWR(phone ? ['whatsapp-thread', phone] : null, () => feed.refresh(), { refreshInterval: 4000 });
  const messages = data?.messages ?? [];

  const [draftState, setDraftState] = useState({ phone, text: '' });
  const draft = draftState.phone === phone ? draftState.text : '';
  const setDraft = (text: string) => setDraftState({ phone, text });
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [actionError, setActionError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const prepend = useRef<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (prepend.current && scroll) {
      scroll.scrollTop = prepend.current.top + scroll.scrollHeight - prepend.current.height;
      prepend.current = null;
    } else if (nearBottom.current && scroll) scroll.scrollTop = scroll.scrollHeight;
  }, [messages.length]);

  const loadOlder = async () => {
    if (loadingOlder) return;
    setLoadingOlder(true); setActionError('');
    try {
      const next = await feed.loadOlder();
      if (scrollRef.current && next.messages.length > messages.length) prepend.current = { top: scrollRef.current.scrollTop, height: scrollRef.current.scrollHeight };
      await mutate(next, { revalidate: false });
    } catch { setActionError('לא הצלחנו לטעון הודעות קודמות. אפשר לנסות שוב.'); }
    finally { setLoadingOlder(false); }
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setActionError('');
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${phone}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        setActionError('השליחה לא אושרה. הטיוטה נשמרה; יש לבדוק את השיחה לפני ניסיון נוסף.');
      } else {
        const sent = await res.json().catch(() => null);
        setDraft('');
        nearBottom.current = true;
        if (sent?.data?.historySynced === false) setActionError('השליחה אושרה, אך ההודעה עדיין לא מוצגת בשיחה. אין לשלוח שוב.');
        await mutate().catch(() => setActionError('ההודעה נשלחה, אך לא הצלחנו לעדכן את ההיסטוריה כרגע. אין צורך לשלוח שוב.'));
      }
    } catch {
      setActionError('לא התקבל אישור מסירה. הטיוטה נשמרה; יש לבדוק אם ההודעה נשלחה לפני ניסיון נוסף.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-8.75rem-env(safe-area-inset-bottom))] flex-col bg-gray-50 md:h-dvh">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-white border-b px-3 py-3">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/inbox`)}
          aria-label="חזרה לרשימת השיחות"
          className="flex h-11 w-11 shrink-0 items-center justify-center -ms-1 rounded-lg hover:bg-gray-100"
        >
          <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </button>
        <h1 className="font-bold text-gray-900" dir="ltr">{phone ? formatPhone(phone) : ''}</h1>
      </header>

      <div ref={scrollRef} onScroll={() => {
        const scroll = scrollRef.current;
        if (scroll) nearBottom.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
      }} className="flex min-h-0 flex-1 overflow-y-auto px-3 py-4 flex-col gap-2">
        {isLoading && <p className="text-gray-500 text-sm">טוען...</p>}
        {error && <p role="alert" className="text-sm text-red-700">לא הצלחנו לעדכן את השיחה. ההודעות שכבר נטענו נשמרו.</p>}
        {data?.hasOlder && <button type="button" disabled={loadingOlder} onClick={loadOlder} className="min-h-11 rounded-xl border bg-white px-4 text-sm text-[#2D5F5F] disabled:opacity-50">{loadingOlder ? 'טוען הודעות קודמות…' : 'הודעות קודמות'}</button>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 flex flex-col ${BUBBLE_STYLE[m.source]}`}>
            <span className="text-[11px] text-gray-400 mb-0.5">{SOURCE_LABEL[m.source]}</span>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <span className="text-[11px] text-gray-400 mt-1 self-end">{formatTime(m.created_at)}</span>
          </div>
        ))}
      </div>

      <div
        className="sticky bottom-0 bg-white border-t px-3 py-3 flex flex-wrap items-end gap-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {actionError && <p role="alert" className="basis-full text-sm text-red-700">{actionError}</p>}
        <textarea
          value={draft}
          disabled={sending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="הקלד תשובה..."
          className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#2D5F5F] max-h-32"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          aria-busy={sending}
          aria-label="שלח"
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700"
        >
          <Send className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
