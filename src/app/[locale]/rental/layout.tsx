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
      ? 'השכירו רכב בקלות דרך SmartCar – בחרו ממגוון רכבים קטנים, סדאנים, SUV ויוקרה. קבלת הרכב עד הבית בכל ישראל. בדקו זמינות והזמינו עכשיו.'
      : 'Rent a car easily through SmartCar – choose from small cars, sedans, SUVs and luxury. Home delivery across Israel. Check availability and book now.',
    alternates: { canonical: `/${locale}/rental` },
  };
}

export default function RentalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
