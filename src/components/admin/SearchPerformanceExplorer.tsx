'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SearchConsoleOverview } from '@/lib/search-console';

type Sort = 'clicks' | 'impressions' | 'ctr' | 'position';
const PAGE_SIZE = 20;

export default function SearchPerformanceExplorer({ data, days, locale }: {
  data: SearchConsoleOverview | null;
  days: 7 | 28 | 90;
  locale: string;
}) {
  const isHe = locale === 'he';
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('clicks');
  const [page, setPage] = useState(1);
  const number = (value: number) => value.toLocaleString(isHe ? 'he-IL' : 'en-GB');
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const labels = isHe
    ? { clicks: 'קליקים', impressions: 'הופעות', ctr: 'שיעור הקלקה', position: 'מיקום ממוצע' }
    : { clicks: 'Clicks', impressions: 'Impressions', ctr: 'CTR', position: 'Average position' };
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const interval = window.setInterval(refresh, 300_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [router]);
  const filtered = useMemo(() => (data?.queries ?? [])
    .filter((row) => row.query.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => (sort === 'position' ? a[sort] - b[sort] : b[sort] - a[sort]) || a.query.localeCompare(b.query)), [data, search, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return <>
    <header className="rounded-3xl bg-[#0D2B2B] p-5 text-white sm:p-7">
      <p className="text-xs font-black tracking-wide text-[#B8D8D8]">GOOGLE SEARCH CONSOLE</p>
      <h1 className="mt-2 text-2xl font-black sm:text-3xl">{isHe ? 'כל החיפושים שמובילים אליך' : 'Searches that lead to you'}</h1>
      <p className="mt-2 text-sm leading-6 text-[#D5E8E8]">{isHe ? 'מגלים מה הלקוחות מחפשים ואיך האתר מופיע ב־Google.' : 'Discover what customers search for and how your site appears on Google.'}</p>
      <nav aria-label={isHe ? 'תקופת הדוח' : 'Report period'} className="mt-5 grid grid-cols-3 gap-2 sm:max-w-sm">
        {([7, 28, 90] as const).map((period) => <Link key={period} prefetch={false} href={`/${locale}/admin/search-performance?days=${period}`} aria-current={days === period ? 'page' : undefined} className={`flex min-h-11 items-center justify-center rounded-xl px-2 text-sm font-bold ${days === period ? 'bg-white text-[#0D2B2B]' : 'bg-white/10 text-white'}`}>{period} {isHe ? 'ימים' : 'days'}</Link>)}
      </nav>
    </header>
    {!data ? <div role="status" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{isHe ? 'נתוני החיפוש אינם זמינים כרגע. אפשר לנסות שוב בעוד רגע.' : 'Search data is temporarily unavailable. Please try again shortly.'}<button onClick={() => router.refresh()} className="mt-3 block min-h-11 rounded-xl border border-amber-300 px-4 font-bold">{isHe ? 'נסה שוב' : 'Try again'}</button></div> : <>
      <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(labels) as Sort[]).map((metric) => <div key={metric} className="min-w-0 rounded-2xl border border-[#D9E8E2] bg-white p-4"><p className="text-xs font-bold text-slate-500">{labels[metric]}</p><p className="mt-1 text-2xl font-black text-[#0D2B2B]">{metric === 'ctr' ? percent(data.ctr) : metric === 'position' ? (data.position ? data.position.toFixed(1) : '—') : number(data[metric])}</p></div>)}
      </div>
      <p className="mb-4 text-xs leading-5 text-slate-500"><bdi dir="ltr">{data.startDate} – {data.endDate}</bdi> · {isHe ? 'נבדק ב־' : 'Checked at '}{new Date(data.fetchedAt).toLocaleTimeString(isHe ? 'he-IL' : 'en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })}</p>
      <section aria-label={isHe ? 'רשימת החיפושים' : 'Search queries'} className="rounded-3xl border border-[#CFE2D8] bg-[#F9FCFA] p-3 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><span className="sr-only">{isHe ? 'חיפוש ביטוי' : 'Find a query'}</span><Search className="pointer-events-none absolute start-3 top-3.5 h-5 w-5 text-[#2D5F5F]" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={isHe ? 'חיפוש בתוך הביטויים…' : 'Search queries…'} className="min-h-12 w-full rounded-2xl border border-[#B8D8D8] bg-white pe-3 ps-10 text-base outline-none focus:ring-2 focus:ring-[#2D5F5F]" /></label>
          <label className="flex items-center gap-2 text-sm font-bold text-[#0D2B2B]"><span>{isHe ? 'מיון לפי' : 'Sort by'}</span><select value={sort} onChange={(event) => { setSort(event.target.value as Sort); setPage(1); }} className="min-h-12 min-w-0 flex-1 rounded-2xl border border-[#B8D8D8] bg-white px-3 text-base sm:w-44">{(Object.keys(labels) as Sort[]).map((metric) => <option key={metric} value={metric}>{labels[metric]}</option>)}</select></label>
        </div>
        <p role="status" className="my-4 text-sm font-bold text-[#476965]">{number(filtered.length)} {isHe ? 'ביטויים' : 'queries'}{search ? ` · ${isHe ? 'מתוך' : 'of'} ${number(data.queries.length)}` : ''}</p>
        <div className="space-y-3 md:hidden">{rows.map((row) => <article key={row.query} className="rounded-2xl border border-[#D9E8E2] bg-white p-4"><h2 className="break-words text-base font-black text-[#0D2B2B]" dir="auto">{row.query}</h2><dl className="mt-4 grid grid-cols-2 gap-3">{(Object.keys(labels) as Sort[]).map((metric) => <div key={metric}><dt className="text-xs font-semibold text-slate-500">{labels[metric]}</dt><dd className="mt-0.5 text-lg font-black text-[#2D5F5F]">{metric === 'ctr' ? percent(row.ctr) : metric === 'position' ? row.position.toFixed(1) : number(row[metric])}</dd></div>)}</dl></article>)}</div>
        <table className="hidden w-full table-fixed text-start md:table"><thead><tr className="text-start text-xs text-slate-500"><th className="w-2/5 p-3 text-start">{isHe ? 'ביטוי חיפוש' : 'Search query'}</th>{(Object.keys(labels) as Sort[]).map((metric) => <th key={metric} className="p-3 text-start">{labels[metric]}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.query} className="border-t border-[#D9E8E2] bg-white text-sm"><th className="break-words p-3 text-start font-bold text-[#0D2B2B]" dir="auto">{row.query}</th><td className="p-3 font-bold">{number(row.clicks)}</td><td className="p-3">{number(row.impressions)}</td><td className="p-3">{percent(row.ctr)}</td><td className="p-3">{row.position.toFixed(1)}</td></tr>)}</tbody></table>
        {!rows.length ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">{isHe ? 'לא נמצאו ביטויים. אפשר לשנות את החיפוש או את התקופה.' : 'No matching queries. Try another search or period.'}</p> : null}
        {pages > 1 ? <nav aria-label={isHe ? 'עמודי תוצאות' : 'Results pages'} className="mt-5 flex items-center justify-between gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="flex min-h-11 items-center gap-1 rounded-xl border border-[#B8D8D8] bg-white px-3 text-sm font-bold text-[#1F5A56] disabled:opacity-40"><ChevronRight className={`h-4 w-4 ${isHe ? '' : 'rotate-180'}`} />{isHe ? 'הקודם' : 'Previous'}</button><span className="text-sm font-bold text-slate-500">{currentPage} / {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="flex min-h-11 items-center gap-1 rounded-xl border border-[#B8D8D8] bg-white px-3 text-sm font-bold text-[#1F5A56] disabled:opacity-40">{isHe ? 'הבא' : 'Next'}<ChevronLeft className={`h-4 w-4 ${isHe ? '' : 'rotate-180'}`} /></button></nav> : null}
      </section>
      <p className="mt-4 px-1 text-xs leading-5 text-slate-500">{isHe ? 'מוצגים הביטויים ש־Google מאפשר להציג לתקופה שנבחרה. ביטויים חסויים ומגבלות Google עשויים לגרום להבדל מול הסיכום הכולל. הנתונים מתעדכנים אוטומטית ומפורסמים בעיכוב של Google.' : 'Shows the queries Google makes available for this period. Private queries and Google limits can cause differences from the overall totals. Data refreshes automatically and is subject to Google reporting delays.'}{data.queriesLimited ? (isHe ? ' מוצגים 100,000 הביטויים הראשונים; בחר תקופה קצרה יותר להצגת יתר הנתונים.' : ' Showing the first 100,000 queries; select a shorter period for more detail.') : ''}</p>
    </>}
  </>;
}
