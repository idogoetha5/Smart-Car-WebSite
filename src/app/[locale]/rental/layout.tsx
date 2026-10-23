import { localeAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import { NATIONAL_RENTAL_ADVICE, rentalCopy } from '@/lib/public-rental-content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: { absolute: rentalCopy(NATIONAL_RENTAL_ADVICE.title, locale) },
    description: rentalCopy(NATIONAL_RENTAL_ADVICE.description, locale),
    alternates: localeAlternates(locale, 'rental'),
  };
}

export default function RentalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
