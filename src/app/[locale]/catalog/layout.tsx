import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: isHe ? 'צי הרכבים' : 'Vehicle Catalog',
    description: isHe
      ? 'עיין בצי הרכבים המלא של SmartCar – מיני, קומפקט, SUV, חשמלי ועוד. סנן לפי קטגוריה, תיבת הילוכים ומחיר.'
      : 'Browse SmartCar\'s full vehicle catalog – mini, compact, SUV, electric and more. Filter by category, transmission, and price.',
    alternates: { canonical: `/${locale}/catalog` },
  };
}

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
