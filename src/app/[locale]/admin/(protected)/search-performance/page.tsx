import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getSearchConsoleOverview } from '@/lib/search-console';
import SearchPerformanceExplorer from '@/components/admin/SearchPerformanceExplorer';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function SearchPerformancePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const days = filters.days === '7' ? 7 : filters.days === '90' ? 90 : 28;
  const data = await getSearchConsoleOverview({ days, allQueries: true });
  const isHe = locale === 'he';
  return <main className="mx-auto max-w-6xl p-4 sm:p-8" dir={isHe ? 'rtl' : 'ltr'}>
    <Link href={`/${locale}/admin`} className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#2D5F5F]"><ArrowRight className={`h-4 w-4 ${isHe ? '' : 'rotate-180'}`} />{isHe ? 'חזרה לדשבורד' : 'Back to dashboard'}</Link>
    <SearchPerformanceExplorer data={data} days={days} locale={locale} />
  </main>;
}
