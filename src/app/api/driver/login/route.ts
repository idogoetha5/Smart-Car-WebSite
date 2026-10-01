import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/server';
import { signDriverToken, verifyDriverToken } from '@/lib/admin-auth';
import { DRIVER_COOKIE, MANAGER_COOKIE, audienceOf, driverRole } from '@/lib/driver-route-auth';
import { checkRateLimit } from '@/lib/ratelimit';

const DRIVER_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'unknown';
}

/** Public: the name picker needs the active-driver (or manager) list before anyone is logged in. Names only — no PIN hashes or other fields. */
export async function GET(request: Request) {
  // ?role=manager → branch managers (their own login page); default → drivers.
  const role = new URL(request.url).searchParams.get('role') === 'manager' ? 'manager' : 'driver';
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('drivers')
    .select('id, name')
    .eq('active', true)
    .eq('role', role)
    .order('name', { ascending: true });

  if (error) {
    console.error('[driver-login] driver list failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const body = await request.json().catch(() => ({}));
  const driverId = String(body?.driverId ?? '').trim();
  const pin = String(body?.pin ?? '').trim();

  // Rate-limited per driver+ip, not just per ip, so one driver mistyping
  // their PIN repeatedly can't lock another driver out of logging in from
  // the same depot wifi.
  const { success, retryAfter } = await checkRateLimit(`driver-login:${ip}:${driverId}`, 5, 15 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  if (!driverId || !pin) {
    return NextResponse.json({ error: 'נא לבחור נהג ולהזין קוד' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: driver, error } = await supabase
    .from('drivers')
    .select('id, pin_hash, active, role')
    .eq('id', driverId)
    .maybeSingle();

  // Same generic error for "no such driver" and "wrong PIN" — the driver
  // list is already public via GET above, so this isn't hiding an
  // enumeration risk, just keeping the failure message simple.
  const genericError = NextResponse.json({ error: 'קוד שגוי' }, { status: 401 });

  if (error) {
    console.error('[driver-login] lookup failed:', error.message);
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 });
  }
  if (!driver || !driver.active) {
    return genericError;
  }

  const pinValid = await bcrypt.compare(pin, driver.pin_hash);
  if (!pinValid) {
    return genericError;
  }

  const token = await signDriverToken(driver.id);
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: DRIVER_COOKIE_MAX_AGE,
    path: '/',
  };
  if ((driver as { role?: string }).role === 'manager') {
    // Manager app session — leaves a driver session on the same phone untouched.
    cookieStore.set(MANAGER_COOKIE, token, options);
  } else {
    // An older manager session lived in driver_auth: keep it as the manager
    // session before the driver login takes that cookie over.
    const previous = await verifyDriverToken(cookieStore.get(DRIVER_COOKIE)?.value);
    if (previous && previous !== driver.id && !cookieStore.get(MANAGER_COOKIE)?.value && (await driverRole(previous)) === 'manager') {
      cookieStore.set(MANAGER_COOKIE, cookieStore.get(DRIVER_COOKIE)!.value, options);
    }
    cookieStore.set(DRIVER_COOKIE, token, options);
  }

  return NextResponse.json({ success: true });
}

/** Log out of one app: ?as=manager → the manager app, otherwise the driver app. */
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  if (audienceOf(request) === 'manager') {
    cookieStore.delete(MANAGER_COOKIE);
    // An older manager session may still be in driver_auth.
    const legacy = await verifyDriverToken(cookieStore.get(DRIVER_COOKIE)?.value);
    if (legacy && (await driverRole(legacy)) === 'manager') cookieStore.delete(DRIVER_COOKIE);
  } else {
    cookieStore.delete(DRIVER_COOKIE);
  }
  return NextResponse.json({ success: true });
}
