'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useApiList } from '@/lib/swr';
import { MessageCircle, AlertCircle } from 'lucide-react';

interface ConversationSummary {
  phone: string;
  displayName?: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSource: string;
  escalated: boolean;
}

function formatPhone(phone: string): string {
  // Stored as digits-only international (e.g. "972501234567") — render as
  // a local-looking number for readability.
  const local = phone.startsWith('972') ? '0' + phone.slice(3) : phone;
  return local.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  return new Date(iso).toLocaleDateString('he-IL');
}

const SOURCE_LABEL: Record<string, string> = {
  customer_inbound: 'לקוח',
  bot_outbound: 'בוט',
  human_reply: 'נציג',
};

export default function AdminInboxPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';

  const { items: conversations, isLoading } = useApiList<ConversationSummary>(
    '/api/admin/whatsapp/conversations',
    { refreshInterval: 5000 }
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" aria-hidden="true" />
          וואטסאפ
        </h1>
      </header>

      {isLoading && <p className="p-4 text-gray-500 text-sm">טוען...</p>}

      {!isLoading && conversations.length === 0 && (
        <p className="p-4 text-gray-500 text-sm">אין שיחות עדיין.</p>
      )}

      <ul className="divide-y divide-gray-200">
        {conversations.map((c) => (
          <li key={c.phone}>
            <Link
              href={`/${locale}/admin/inbox/${c.phone}`}
              className="block min-w-0 px-4 py-4 active:bg-gray-100 hover:bg-gray-50"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 whitespace-nowrap" dir="ltr">
                    {formatPhone(c.phone)}
                  </span>
                  {c.displayName && <span className="min-w-0 truncate text-sm text-gray-700" title={c.displayName}>({c.displayName})</span>}
                  {c.escalated && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" aria-hidden="true" />
                      דורש טיפול
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{relativeTime(c.lastMessageAt)}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 break-words text-sm leading-6 text-gray-600">
                <span className="text-gray-500">{SOURCE_LABEL[c.lastSource] ?? c.lastSource}:</span>{' '}
                {c.lastMessage}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
