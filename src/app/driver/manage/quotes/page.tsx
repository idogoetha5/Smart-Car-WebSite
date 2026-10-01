import Link from 'next/link';
import { ArrowLeft, CalendarRange, FileText } from 'lucide-react';

const QUOTES = [
  {
    href: '/driver/manage/quotes/rental',
    title: 'הצעת מחיר להשכרה',
    text: 'השכרה לפי ימים, תוספות, ביטוח, פיקדון ותנאים.',
    icon: CalendarRange,
    tone: 'bg-orange-50 text-[#E8743B]',
  },
  {
    href: '/driver/manage/quotes/leasing',
    title: 'הצעת מחיר ליסינג',
    text: 'מסלול חודשי, מקדמה, תקופה, קילומטרים ותנאי העסקה.',
    icon: FileText,
    tone: 'bg-[#eef6f6] text-[#2D5F5F]',
  },
] as const;

export default function ManagerQuotesPage() {
  return (
    <div dir="rtl">
      <h1 className="text-2xl font-black text-[#0D2B2B] sm:text-3xl">הצעות מחיר</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">יצירת PDF מקצועי ושליחה ישירה ל-WhatsApp של הלקוח.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {QUOTES.map(({ href, title, text, icon: Icon, tone }) => (
          <Link key={href} href={href} className="group flex min-h-32 items-center gap-4 rounded-3xl bg-white p-5 text-start shadow-sm ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:shadow-md">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
              <Icon className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-black text-[#0D2B2B]">{title}</span>
              <span className="mt-1 block text-sm leading-6 text-gray-500">{text}</span>
            </span>
            <ArrowLeft className="h-5 w-5 shrink-0 text-gray-300 transition group-hover:-translate-x-1 group-hover:text-[#2D5F5F]" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
