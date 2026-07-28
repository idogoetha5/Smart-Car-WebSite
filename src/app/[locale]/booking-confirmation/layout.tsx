import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';

// Private / transactional route: also declared at the document level, not
// only via the X-Robots-Tag header in next.config.ts, because that header
// isn't applied on client-side navigations into this route.
export const metadata: Metadata = { robots: NOINDEX };

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
