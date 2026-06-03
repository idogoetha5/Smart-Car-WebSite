import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signAdminToken } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/ratelimit';
import bcrypt from 'bcryptjs';

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

  const { password } = await request.json();

  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const plaintextPassword = process.env.ADMIN_PASSWORD;

  // A valid bcrypt hash starts with $2b$ or $2a$
  const isBcryptHash = (s: string) => /^\$2[ab]\$\d+\$/.test(s);

  let passwordValid = false;

  if (passwordHash && isBcryptHash(passwordHash)) {
    passwordValid = await bcrypt.compare(password, passwordHash);
  } else if (plaintextPassword) {
    console.warn('[admin-login] ADMIN_PASSWORD_HASH not set — using plaintext comparison (insecure)');
    passwordValid = password === plaintextPassword;
  } else {
    return NextResponse.json({ success: false }, { status: 500 });
  }

  if (!passwordValid) {
    return NextResponse.json({ success: false }, { status: 401 });
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
