import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '../i18n';
import { verifyAdminToken, verifyInboxToken } from '@/lib/admin-auth';

// Daniel's WhatsApp-inbox trial (see src/app/api/admin/whatsapp/inbox-login)
// uses a separate, narrower cookie instead of the full admin session — both
// gates below have to recognize it, scoped to only these paths, or a valid
// inbox_auth cookie would still bounce off the admin-only checks here.
const INBOX_API_PREFIX = '/api/admin/whatsapp/conversations';
const INBOX_LOGIN_API = '/api/admin/whatsapp/inbox-login';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

/**
 * Which locale a first-time visitor should land on.
 *
 * Plain Accept-Language negotiation sent most Israeli visitors to /en:
 * Chrome in Israel commonly reports en-US first, so someone who searched in
 * Hebrew and clicked through from Google got the English site. Hebrew is the
 * primary market, so it wins unless the browser asks for English and does
 * not mention Hebrew at all.
 *
 *   he anywhere in the header        -> he
 *   en present and he absent         -> en
 *   neither, or no header at all     -> he
 *
 * An explicit choice always beats this: next-intl reads the NEXT_LOCALE
 * cookie before Accept-Language, so once a visitor uses the language
 * toggle their choice sticks.
 */
export function preferredLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return 'he';
  // Match language subtags only, so "he" doesn't match inside a token like
  // "the" and en-GB / he-IL are both recognised. `iw` is the legacy code
  // for Hebrew and is still emitted by some clients.
  const tags = acceptLanguage
    .toLowerCase()
    .split(',')
    .map((part) => part.split(';')[0].trim().split('-')[0]);

  if (tags.includes('he') || tags.includes('iw')) return 'he';
  if (tags.includes('en')) return 'en';
  return 'he';
}

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
    if (!pathname.startsWith('/api/admin/login') && pathname !== INBOX_LOGIN_API) {
      const adminOk = await verifyAdminToken(request.cookies.get('admin_auth')?.value ?? '');
      if (!adminOk) {
        const inboxOk = pathname.startsWith(INBOX_API_PREFIX)
          && await verifyInboxToken(request.cookies.get('inbox_auth')?.value ?? '');
        if (!inboxOk) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }
    }

    return NextResponse.next();
  }

  // Protect admin routes — redirect to login if not authenticated. The
  // PIN-entry page itself is excluded the same way /admin/login is; the
  // inbox page it leads to accepts the PIN cookie as an alternative below.
  if (pathname.match(/\/[a-z]{2}\/admin/) && !pathname.includes('/admin/login') && !pathname.includes('/admin/inbox-login')) {
    const adminOk = await verifyAdminToken(request.cookies.get('admin_auth')?.value ?? '');
    if (!adminOk) {
      const inboxOk = pathname.includes('/admin/inbox')
        && await verifyInboxToken(request.cookies.get('inbox_auth')?.value ?? '');
      if (!inboxOk) {
        const locale = pathname.split('/')[1] || defaultLocale;
        return NextResponse.redirect(new URL(`/${locale}/admin/login`, request.url));
      }
    }
  }

  // Normalise Accept-Language to the locale we want next-intl to pick, so
  // its own negotiation lands on Hebrew for anyone who reads Hebrew. Only
  // done when the visitor has not already chosen a language — next-intl
  // checks NEXT_LOCALE first, and that choice must not be overridden.
  if (!request.cookies.get('NEXT_LOCALE')) {
    const headers = new Headers(request.headers);
    headers.set('accept-language', preferredLocale(headers.get('accept-language')));
    return intlMiddleware(new NextRequest(request.nextUrl, { headers }));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/api/admin/(.*)',
    // `q/` is the customer-facing document link. It is not a localized page,
    // so next-intl must not rewrite it to /he/q/... (which is a 404).
    '/((?!api|q/|_next/static|_next/image|favicon.ico|icon.png|icons|images|robots.txt|sitemap.xml).*)',
  ],
};
