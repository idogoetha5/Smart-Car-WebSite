'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApiList } from '@/lib/swr';
import { ArrowRight, Send } from 'lucide-react';

interface Message {
  id: number;
  source: 'customer_inbound' | 'bot_outbound' | 'human_reply';
  body: string;
  created_at: string;
  escalated_at: string | null;
}

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

  const { items: messages, isLoading, mutate } = useApiList<Message>(
    phone ? `/api/admin/whatsapp/conversations/${phone}` : null,
    { refreshInterval: 4000 }
  );

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    setDraft('');
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${phone}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        setDraft(message); // restore on failure so nothing is lost
        window.alert('שליחה נכשלה, נסה שוב.');
      } else {
        await mutate();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.25rem)] md:h-screen bg-gray-50">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-white border-b px-3 py-3">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/inbox`)}
          aria-label="חזרה לרשימת השיחות"
          className="flex items-center justify-center w-9 h-9 -ms-1 rounded-lg hover:bg-gray-100"
        >
          <ArrowRight className="w-5 h-5" aria-hidden="true" />
        </button>
        <h1 className="font-bold text-gray-900" dir="ltr">{phone ? formatPhone(phone) : ''}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2">
        {isLoading && <p className="text-gray-500 text-sm">טוען...</p>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 flex flex-col ${BUBBLE_STYLE[m.source]}`}>
            <span className="text-[11px] text-gray-400 mb-0.5">{SOURCE_LABEL[m.source]}</span>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <span className="text-[11px] text-gray-400 mt-1 self-end">{formatTime(m.created_at)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div
        className="sticky bottom-0 bg-white border-t px-3 py-3 flex items-end gap-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="הקלד תשובה..."
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          aria-label="שלח"
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700"
        >
          <Send className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
