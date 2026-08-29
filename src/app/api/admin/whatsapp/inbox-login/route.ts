import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkRateLimit } from '@/lib/ratelimit';
import { signInboxToken } from '@/lib/admin-auth';

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'unknown';
}

/**
 * Daniel's entry point for the WhatsApp-inbox trial — a plain 4-digit PIN
 * instead of the full admin password+TOTP, scoped (via signInboxToken) to
 * the whatsapp conversation routes only. See src/lib/admin-auth.ts.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { success } = await checkRateLimit(`inbox-login:${ip}`, 10, 15 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ success: false, error: 'Too many attempts' }, { status: 429 });
  }

  const pin = process.env.WHATSAPP_INBOX_PIN;
  if (!pin) {
    console.error('[inbox-login] WHATSAPP_INBOX_PIN is not set — refusing all logins');
    return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  if (String(body?.pin ?? '').trim() !== pin) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const token = await signInboxToken();
  const cookieStore = await cookies();
  cookieStore.set('inbox_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return NextResponse.json({ success: true });
}
