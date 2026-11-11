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
    title: { absolute: isHe ? 'צי הרכבים של SmartCar – כל הדגמים להשכרה' : 'SmartCar Fleet – All Rental Car Models' },
    description: isHe
      ? 'כל הדגמים בצי SmartCar: רכבים קטנים, משפחתיים, SUV, היברידיים, 7 מקומות ומסחריים. סננו לפי קטגוריה, גיר ומחיר ליום, ראו תמונות ומפרט ועברו לבקשה.'
      : 'Every model in the SmartCar fleet: small, family, SUV, hybrid, 7-seat and commercial cars. Filter by category, transmission and daily price, see photos and specs, and request a car.',
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
