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
      ? 'עיינו בצי הרכבים המלא של SmartCar – מיני, קומפקט, סדאן, SUV, חשמלי ומסחרי. סננו לפי קטגוריה, תיבת הילוכים ומחיר יומי. מצאו את הרכב המושלם.'
      : 'Browse SmartCar\'s full vehicle catalog – mini, compact, sedan, SUV, electric and commercial. Filter by category, transmission, and daily price.',
    alternates: { canonical: `/${locale}/catalog` },
  };
}

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
