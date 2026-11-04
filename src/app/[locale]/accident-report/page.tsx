import type { Metadata } from 'next';
import AccidentReportForm from '@/components/accident-report/AccidentReportForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale !== 'en';
  const title = isHe ? 'דו״ח תאונה – סמארט קאר' : 'Accident report – SmartCar';
  const description = isHe
    ? 'מילוי דו״ח תאונה מהיר בטלפון, כ־3 דקות. הדו״ח נשלח ישירות למשרד סמארט קאר.'
    : 'Fill in your accident report on your phone in about 3 minutes. It goes straight to the SmartCar office.';
  const image = {
    url: `/images/og-accident-report-${isHe ? 'he' : 'en'}.png`,
    width: 1200,
    height: 630,
    alt: isHe ? 'דו״ח תאונה – סמארט קאר' : 'SmartCar accident report',
    type: 'image/png',
  };
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `/${locale}/accident-report` },
    openGraph: {
      title,
      description,
      url: `/${locale}/accident-report`,
      siteName: 'SmartCar',
      locale: isHe ? 'he_IL' : 'en_US',
      type: 'website',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
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
