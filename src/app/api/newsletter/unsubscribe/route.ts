import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Active unsubscribe + suppression.
 *
 * Setting `unsubscribed_at` is what puts the address on the suppression
 * list: any future send must exclude rows where it is non-null, and the
 * signup route only clears it on a fresh explicit consent.
 *
 * Always answers the same way whether or not the address was subscribed —
 * otherwise this endpoint would confirm whether a given email is on the
 * list to anyone who asks.
 */
async function unsubscribe(email: string): Promise<'ok' | 'error'> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('newsletter_subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('email', email);
    if (error) {
      console.error('[newsletter/unsubscribe] failed:', error.message);
      return 'error';
    }
    return 'ok';
  } catch (err) {
    console.error('[newsletter/unsubscribe] error:', err);
    return 'error';
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success, retryAfter } = await checkRateLimit(`newsletter-unsub:${ip}`, 10, 60_000);
  if (!success) {
    return NextResponse.json(
      { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'כתובת אימייל לא תקינה' }, { status: 400 });
  }

  const result = await unsubscribe(email);
  if (result === 'error') {
    return NextResponse.json({ error: 'ההסרה נכשלה, נסו שוב' }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}

/**
 * One-click unsubscribe from an email link:
 * /api/newsletter/unsubscribe?token=…
 *
 * The token replaces a raw ?email= parameter. An address in a URL ends up in
 * browser history, server logs and referrer headers, and it let anyone
 * unsubscribe any address they could guess. The token is opaque, signed, and
 * only this server can issue or read it.
 *
 * A raw ?email= is still accepted for one narrow reason: links already sitting
 * in customers' inboxes were built that way, and an unsubscribe link that
 * stops working traps people on a list they asked to leave. It is honoured but
 * no longer generated, and it should be removed once those mails have aged
 * out.
 */
export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'he';
  const token = request.nextUrl.searchParams.get('token');

  if (token) {
    const result = verifyUnsubscribeToken(token);
    if (result.valid) await unsubscribe(result.email);
  } else {
    const legacyEmail = String(request.nextUrl.searchParams.get('email') ?? '')
      .trim()
      .toLowerCase();
    if (EMAIL_RE.test(legacyEmail)) await unsubscribe(legacyEmail);
  }

  // Redirect to the confirmation page regardless, so the link never
  // reveals whether the address was on the list.
  return NextResponse.redirect(
    new URL(`/${locale}/unsubscribe?done=1`, request.url)
  );
}
