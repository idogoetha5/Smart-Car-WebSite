import type { Metadata } from 'next';
import AccidentReportForm from '@/components/accident-report/AccidentReportForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'he' ? 'דיווח על תאונה' : 'Report an accident',
    robots: { index: false, follow: false },
  };
}

export default async function AccidentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ b?: string; t?: string }>;
}) {
  const { locale } = await params;
  const { b, t } = await searchParams;
  const branch = typeof b === 'string' && /^[a-z-]{2,20}$/.test(b) ? b : undefined;
  const token = typeof t === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(t) ? t : undefined;
  return <AccidentReportForm locale={locale === 'en' ? 'en' : 'he'} branch={branch} token={token} />;
}
