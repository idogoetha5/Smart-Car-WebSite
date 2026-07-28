import type { Metadata } from 'next';

/**
 * Canonical + hreflang for one route, in both locales.
 *
 * Next.js merges `alternates` per top-level field, so a page that sets
 * `alternates: { canonical }` replaces the layout's whole alternates
 * object and silently loses `languages` — which is how most inner pages
 * ended up with no hreflang at all. Always going through this helper
 * keeps the two in sync.
 *
 * `path` is the route below the locale segment, with no leading slash
 * ('' for the home page, 'services/new-driver' for a nested route).
 * Paths are relative — `metadataBase` in the locale layout resolves them
 * against NEXT_PUBLIC_APP_URL, so the canonical host is configured in
 * exactly one place.
 */
export function localeAlternates(locale: string, path = ''): Metadata['alternates'] {
  const suffix = path ? `/${path}` : '';
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      he: `/he${suffix}`,
      en: `/en${suffix}`,
      // Hebrew is the primary market and the default locale.
      'x-default': `/he${suffix}`,
    },
  };
}

/**
 * Locale-correct Open Graph image descriptor. The alt text was previously
 * hard-coded in Hebrew for both locales, so English pages shipped a
 * Hebrew alt attribute.
 */
export function ogImage(locale: string) {
  return {
    url: '/images/og-image.png',
    width: 1200,
    height: 630,
    alt:
      locale === 'he'
        ? 'SmartCar – השכרת רכב עד בית הלקוח'
        : 'SmartCar – car rental delivered to your door',
    type: 'image/png',
  };
}

/**
 * Private / transactional routes: keep them out of the index at the
 * document level too, not only via the X-Robots-Tag header set in
 * next.config.ts (headers don't apply to client-side navigations).
 */
export const NOINDEX: Metadata['robots'] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};
