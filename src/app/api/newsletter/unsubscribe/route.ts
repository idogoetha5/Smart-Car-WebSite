import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';

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

/** One-click unsubscribe from an email link: /api/newsletter/unsubscribe?email=… */
export async function GET(request: NextRequest) {
  const email = String(request.nextUrl.searchParams.get('email') ?? '')
    .trim()
    .toLowerCase();
  const locale = request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'he';

  if (EMAIL_RE.test(email)) await unsubscribe(email);

  // Redirect to the confirmation page regardless, so the link never
  // reveals whether the address was on the list.
  return NextResponse.redirect(
    new URL(`/${locale}/unsubscribe?done=1`, request.url)
  );
}
