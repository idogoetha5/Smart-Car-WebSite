import { LeasingQuoteBuilder } from '@/app/[locale]/admin/(protected)/quotes/page';

export default function ManagerLeasingQuotePage() {
  return <LeasingQuoteBuilder loginUrl="/driver/manager-login" />;
}
