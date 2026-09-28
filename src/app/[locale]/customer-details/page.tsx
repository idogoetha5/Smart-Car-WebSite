import type { Metadata } from 'next';
import CustomerDetailsForm from '@/components/customer-details/CustomerDetailsForm';
import { type BranchId } from '@/lib/branches';
import { localeAlternates, NOINDEX } from '@/lib/seo';

const branchIds = new Set<BranchId>(['herzliya', 'telaviv', 'jerusalem', 'airport']);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: isHe ? 'פרטי לקוח להשכרה' : 'Rental customer details',
    description: isHe ? 'טופס מאובטח למסירת פרטי לקוח להשכרת רכב ב-SmartCar.' : 'Secure SmartCar rental customer details form.',
    alternates: localeAlternates(locale, 'customer-details'),
    robots: NOINDEX,
  };
}

export default async function CustomerDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ branch?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const requestedBranch = query.branch as BranchId | undefined;
  const initialBranch = requestedBranch && branchIds.has(requestedBranch) ? requestedBranch : 'herzliya';
  return <CustomerDetailsForm locale={locale === 'he' ? 'he' : 'en'} initialBranch={initialBranch} />;
}
