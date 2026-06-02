import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: isHe ? 'השכרת רכב' : 'Car Rental',
    description: isHe
      ? 'השכר רכב עם משלוח עד הבית – בחר מתוך צי רכבים מגוון, מחירים שקופים וזמינות מיידית בכל ישראל.'
      : 'Rent a car with home delivery – choose from a diverse fleet, transparent pricing, and immediate availability across Israel.',
    alternates: { canonical: `/${locale}/rental` },
  };
}

export default function RentalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
