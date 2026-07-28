import { localeAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: { absolute: isHe ? 'רכבים להשכרה | SmartCar' : 'Vehicles for Rent | SmartCar' },
    description: isHe
      ? 'מבחר רכבים מהצי של SmartCar. שלחו בקשה ונבדוק זמינות בצי המלא לפי תאריכים ומיקום.'
      : 'A selection of vehicles from the SmartCar fleet. Send a request and we will check availability in the full fleet by dates and location.',
    alternates: localeAlternates(locale, 'rental'),
  };
}

export default function RentalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
