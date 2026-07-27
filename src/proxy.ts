import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '../i18n';
import { verifyAdminToken } from '@/lib/admin-auth';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

// Old site (pre smartcar.co.il migration) used root-level Hebrew slugs with
// no locale prefix. Google still has ~27 of these indexed. next-intl's
// proxy runs before next.config.ts `redirects`, and it was blindly
// prefixing these unmatched paths with /he/ instead of letting the config
// redirects fire, so these have to live here instead.
const OLD_PATH_REDIRECTS: Record<string, string> = {
  '/אודות': '/he/about',
  '/סניפים': '/he/branches',
  '/השכרת-רכב': '/he/rental',
  '/לוח-רכבים-למכירה': '/he/cars-for-sale',
  '/שרותים/מכירת-רכב': '/he/cars-for-sale',
  '/שרותים/השכרת-רכב': '/he/rental',
  '/שרותים/ליסינג-עסקי': '/he/leasing',
  '/שרותים/business-leasing': '/he/leasing',
  '/יונדאי-inspire-1-4-i20': '/he/catalog',
  '/יונדאי-inspire-11-4-i20': '/he/catalog',
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // request.nextUrl.pathname's decode-state for non-ASCII segments isn't
  // guaranteed here — normalize so the old-URL matching below works
  // whether it arrives decoded or still percent-encoded.
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    // pathname wasn't encoded (or was malformed) — use it as-is
  }

  console.log('[old-url-redirect-debug]', JSON.stringify({ pathname, decodedPathname }));

  const oldPathDestination = OLD_PATH_REDIRECTS[decodedPathname];
  if (oldPathDestination) {
    return NextResponse.redirect(new URL(oldPathDestination, request.url), 308);
  }
  // Old fleet section (category + individual vehicle pages) has no 1:1
  // equivalent under the new vehicle data model — send it all to the
  // live catalog.
  if (decodedPathname === '/צי-רכבים' || decodedPathname.startsWith('/צי-רכבים/')) {
    return NextResponse.redirect(new URL('/he/catalog', request.url), 308);
  }

  if (pathname.startsWith('/api/admin/')) {
    // CSRF protection for mutating admin API requests
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');
      if (origin && host) {
        try {
          if (new URL(origin).host !== host) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    // Defense-in-depth: every admin API route already verifies the session
    // itself, but enforce it here too (except login, which issues the
    // cookie) so a future route can't be silently exposed by forgetting to.
    if (!pathname.startsWith('/api/admin/login')) {
      const token = request.cookies.get('admin_auth')?.value ?? '';
      if (!await verifyAdminToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    return NextResponse.next();
  }

  // Protect admin routes — redirect to login if not authenticated
  if (pathname.match(/\/[a-z]{2}\/admin/) && !pathname.includes('/admin/login')) {
    const token = request.cookies.get('admin_auth')?.value ?? '';
    if (!await verifyAdminToken(token)) {
      const locale = pathname.split('/')[1] || defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}/admin/login`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/api/admin/(.*)',
    '/((?!api|_next/static|_next/image|favicon.ico|icons|images|robots.txt|sitemap.xml).*)',
  ],
};
