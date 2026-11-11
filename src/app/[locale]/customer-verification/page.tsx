import type { Metadata } from 'next';
import VerificationForm from '@/components/customer-verification/VerificationForm';

/**
 * Unlisted page: reachable only through the personal link the office sends
 * on WhatsApp. Not in the menu, footer or sitemap, never indexed, and
 * without a valid token it shows only "link not valid".
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale !== 'en';
  return {
    title: { absolute: isHe ? 'פרטי רישיון ואשראי – סמארט קאר' : 'Licence and card details – SmartCar' },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: 'no-referrer',
  };
}

export default async function CustomerVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale } = await params;
  const { t } = await searchParams;
  const token = typeof t === 'string' && /^[A-Za-z0-9_-]{20,80}$/.test(t) ? t : undefined;
  return <VerificationForm locale={locale === 'en' ? 'en' : 'he'} token={token} />;
}
