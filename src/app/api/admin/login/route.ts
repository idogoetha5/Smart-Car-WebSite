import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signAdminToken } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/ratelimit';
import bcrypt from 'bcryptjs';
import { verifyTotp } from '@/lib/totp';

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { success, retryAfter } = await checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const { password, totp } = await request.json();

  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const plaintextPassword = process.env.ADMIN_PASSWORD;

  // A valid bcrypt hash starts with $2b$ or $2a$
  const isBcryptHash = (s: string) => /^\$2[ab]\$\d+\$/.test(s);

  let passwordValid = false;

  if (passwordHash && isBcryptHash(passwordHash)) {
    passwordValid = await bcrypt.compare(password, passwordHash);
  } else if (plaintextPassword && process.env.NODE_ENV !== 'production') {
    console.warn('[admin-login] ADMIN_PASSWORD_HASH not set — using plaintext comparison (insecure, dev-only)');
    passwordValid = password === plaintextPassword;
  } else {
    console.error('[admin-login] ADMIN_PASSWORD_HASH is not set to a valid bcrypt hash — refusing all logins');
    return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
  }

  if (!passwordValid) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  // Second factor. The password is shared, so on its own a leak is the whole
  // story — the code proves the person also holds the enrolled phone.
  //
  // Enabled only when ADMIN_TOTP_SECRET is set, so enrolling is a deliberate
  // step and nobody is locked out by a deploy. Once it IS set, it is required:
  // there is no "skip if the code is missing" path, which would make the
  // factor optional for exactly the person who did not want to provide it.
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  if (totpSecret) {
    const code = String(totp ?? '').trim();
    if (!code) {
      // Distinguishable from a wrong code on purpose: the client needs to know
      // to show the field. It reveals nothing — whether TOTP is on is not a
      // secret, and this is only reachable after the password already matched.
      return NextResponse.json(
        { success: false, error: 'totp_required' },
        { status: 401 },
      );
    }
    if (!(await verifyTotp(totpSecret, code))) {
      return NextResponse.json({ success: false, error: 'totp_invalid' }, { status: 401 });
    }
  }

  let token: string;
  try {
    token = await signAdminToken();
  } catch {
    return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set('admin_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_auth');
  return NextResponse.json({ success: true });
}
