'use client';

import { BarChart3, ExternalLink, List, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { SearchConsoleOverview } from '@/lib/search-console';

function percent(value: number) {
  return new Intl.NumberFormat('he-IL', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function SearchConsolePanel({
  data,
  locale,
}: {
  data: SearchConsoleOverview | null;
  locale: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  const isHe = locale === 'he';
  const searchConsoleUrl = 'https://search.google.com/search-console';

  if (!data) {
    return (
      <section className="mb-8 overflow-hidden rounded-3xl border border-[#CFE2D8] bg-[#F9FCFA] p-5 shadow-[0_12px_32px_rgba(13,43,43,0.06)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0D2B2B] text-[#CDE6DA]"><Search className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black tracking-wide text-[#2D5F5F]">GOOGLE SEARCH CONSOLE</p>
            <h2 className="mt-1 text-xl font-black text-[#0D2B2B]">{isHe ? 'ביצועי החיפוש של האתר' : 'Search performance'}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{isHe ? 'כאן יוצגו החיפושים שמביאים לקוחות, קליקים, הופעות ומיקום ממוצע. נותר רק לחבר הרשאת קריאה מאובטחת לחשבון Search Console.' : 'This area will show searches, clicks, impressions and average position once read-only Search Console access is connected.'}</p>
          </div>
        </div>
        <Link href={`/${locale}/admin/search-performance`} prefetch={false} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#B8D8D8] bg-white px-3 text-sm font-bold text-[#1F5A56]"><List className="h-4 w-4" />{isHe ? 'כל החיפושים' : 'All searches'}</Link>
        <a href={searchConsoleUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#B8D8D8] bg-white px-4 text-sm font-black text-[#1F5A56] sm:w-auto">
          {isHe ? 'פתיחת Google Search Console' : 'Open Google Search Console'} <ExternalLink className="h-4 w-4" />
        </a>
      </section>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-[#CFE2D8] bg-[#F9FCFA] p-5 shadow-[0_12px_32px_rgba(13,43,43,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0D2B2B] text-[#CDE6DA]"><BarChart3 className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-black tracking-wide text-[#2D5F5F]">GOOGLE SEARCH CONSOLE</p>
            <h2 className="mt-1 text-xl font-black text-[#0D2B2B]">{isHe ? 'הביצועים שלך בגוגל' : 'Your Google performance'}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500"><bdi>{data.startDate}–{data.endDate}</bdi> · {isHe ? 'חיפוש אורגני' : 'Organic search'}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/${locale}/admin/search-performance`} prefetch={false} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#B8D8D8] bg-white px-3 text-xs font-black text-[#1F5A56]"><List className="h-4 w-4" aria-hidden="true" />{isHe ? 'כל החיפושים' : 'All searches'}</Link>
          <a href={searchConsoleUrl} target="_blank" rel="noopener noreferrer" aria-label={isHe ? 'פתיחת Google Search Console' : 'Open Google Search Console'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#B8D8D8] bg-white text-[#1F5A56]"><ExternalLink className="h-4 w-4" /></a>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500" suppressHydrationWarning>{isHe ? 'עדכון אוטומטי כל 5 דקות · נבדק ב־' : 'Refreshes automatically every 5 minutes · Checked at '}{new Date(data.fetchedAt).toLocaleTimeString(isHe ? 'he-IL' : 'en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })}{isHe ? ' · הנתונים מתפרסמים בעיכוב של Google' : ' · Google reporting is delayed'}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [isHe ? 'קליקים' : 'Clicks', data.clicks.toLocaleString()],
          [isHe ? 'הופעות' : 'Impressions', data.impressions.toLocaleString()],
          [isHe ? 'שיעור הקלקה' : 'Click-through rate', percent(data.ctr)],
          [isHe ? 'מיקום ממוצע' : 'Average position', data.position ? data.position.toFixed(1) : '—'],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[#D9E8E2] bg-white p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-[#0D2B2B]">{value}</p></div>)}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-[#0D2B2B]">{isHe ? 'החיפושים המובילים' : 'Top searches'}</h3><span className="text-xs font-bold text-slate-400">{isHe ? 'קליקים מול הופעות' : 'Clicks vs impressions'}</span></div>
        <div className="space-y-2">
          {data.queries.slice(0, 3).map((query) => <div key={query.query} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3"><p className="min-w-0 break-words text-sm font-black text-[#0D2B2B]">{query.query}</p><div className="shrink-0 text-end"><p className="text-sm font-black text-[#1F5A56]">{query.clicks.toLocaleString()} <span className="text-xs font-bold text-slate-400">{isHe ? 'קליקים' : 'clicks'}</span></p><p className="text-xs text-slate-500">{query.impressions.toLocaleString()} {isHe ? 'הופעות' : 'impressions'}</p></div></div>)}
          {!data.queries.length ? <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-500">{isHe ? 'אין עדיין נתוני חיפוש לתקופה זו.' : 'No search data is available for this period yet.'}</p> : null}
        </div>
      </div>
    </section>
  );
}
