import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '../i18n';
import { verifyAdminToken } from '@/lib/admin-auth';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    '/((?!api|_next/static|_next/image|favicon.ico|icons|images|robots.txt|sitemap.xml).*)',
  ],
};
