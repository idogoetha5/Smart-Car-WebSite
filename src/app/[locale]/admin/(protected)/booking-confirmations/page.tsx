'use client';

import { useLocale } from 'next-intl';
import { RentalQuoteBuilder } from '../rental-quotes/page';

export default function BookingConfirmationsPage() {
  const locale = useLocale();
  return <RentalQuoteBuilder adminLocale={locale} confirmationOnly />;
}
