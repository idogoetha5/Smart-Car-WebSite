import { cookies } from 'next/headers';
import { verifyAdminToken, verifyDriverToken } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Two separate sessions, so one phone can be logged in to both apps:
 * - `driver_auth`  — the driver app (/driver). Set when a driver logs in.
 * - `manager_auth` — the manager app (/driver/manage). Set when a branch manager logs in.
 * Both hold the same signed token (a drivers.id). Older manager sessions
 * still sit in `driver_auth` with a manager row; they keep working in the
 * manager app until the next login.
 *
 * Every /api/driver/* route (except login) is reachable by either cookie or
 * by admin_auth — proxy.ts enforces this at the edge already, this is the
 * same check repeated per-route as defense-in-depth.
 */
export const DRIVER_COOKIE = 'driver_auth';
export const MANAGER_COOKIE = 'manager_auth';

export type Audience = 'driver' | 'manager';

/** `?as=manager` on a shared route (me, push) means "the manager app is asking". */
export function audienceOf(request: Request): Audience {
  return new URL(request.url).searchParams.get('as') === 'manager' ? 'manager' : 'driver';
}

async function sessionIds(): Promise<{ driver: string | null; manager: string | null; admin: boolean }> {
  const cookieStore = await cookies();
  const [driver, manager, admin] = await Promise.all([
    verifyDriverToken(cookieStore.get(DRIVER_COOKIE)?.value),
    verifyDriverToken(cookieStore.get(MANAGER_COOKIE)?.value),
    verifyAdminToken(cookieStore.get('admin_auth')?.value ?? ''),
  ]);
  return { driver, manager, admin };
}

/**
 * The person using a shared /api/driver/* route. The driver app (default)
 * prefers the driver session; the manager app (`as: 'manager'`) prefers
 * the manager session.
 */
export async function requireDriverOrAdmin(as: Audience = 'driver'): Promise<{ ok: boolean; driverId: string | null }> {
  const s = await sessionIds();
  const order = as === 'manager' ? [s.manager, s.driver] : [s.driver, s.manager];
  const driverId = order.find(Boolean) ?? null;
  if (driverId) return { ok: true, driverId };
  return { ok: s.admin, driverId: null };
}

/** Role of a logged-in driver row: 'manager' = branch manager (assigns tasks). */
export async function driverRole(driverId: string): Promise<'driver' | 'manager' | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('drivers').select('role, active').eq('id', driverId).maybeSingle();
  if (error) {
    // Before the add-driver-role migration runs there is no role column.
    console.error('[driver-route-auth] role lookup failed:', error.message);
    return null;
  }
  if (!data || data.active === false) return null;
  return data.role === 'manager' ? 'manager' : 'driver';
}

/**
 * Branch-manager routes (/api/driver/manage/*): a manager session (or an
 * older driver_auth cookie of a manager row), or an admin cookie.
 */
export async function requireManagerOrAdmin(): Promise<{ ok: boolean; managerId: string | null }> {
  const s = await sessionIds();
  for (const id of [s.manager, s.driver]) {
    if (id && (await driverRole(id)) === 'manager') return { ok: true, managerId: id };
  }
  return { ok: s.admin, managerId: null };
}
