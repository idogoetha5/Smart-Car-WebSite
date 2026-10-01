import { RentalQuoteBuilder } from '@/app/[locale]/admin/(protected)/rental-quotes/page';

export default function ManagerRentalQuotePage() {
  return <RentalQuoteBuilder adminLocale="he" loginUrl="/driver/manager-login" />;
}
