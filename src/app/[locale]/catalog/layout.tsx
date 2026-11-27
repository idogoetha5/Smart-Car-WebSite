import JsonLd from '@/components/seo/JsonLd';
import { localeAlternates, breadcrumbJsonLd } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: { absolute: isHe ? 'קטלוג רכבים להשכרה – דגמים ומפרטים | SmartCar' : 'Rental Car Fleet in Israel – Models & Specifications | SmartCar' },
    description: isHe
      ? 'הכירו מבחר רכבים להשכרה מהצי של SmartCar. סננו לפי קטגוריה, מספר מושבים ומחיר ליום, השוו תמונות ומפרטים ושלחו בקשה לרכב שמתאים לכם.'
      : 'Explore a selection from the SmartCar rental fleet in Israel. Filter by category, seats and daily price, compare photos and specifications, and request a car.',
    alternates: localeAlternates(locale, 'catalog'),
  };
}

export default async function CatalogLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, [{ name: locale === 'he' ? 'צי הרכבים' : 'Fleet', path: 'catalog' }])} />
      {children}
    </>
  );
}
