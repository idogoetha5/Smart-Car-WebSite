import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { createAdminClient } from '@/lib/supabase/server';

const PIN_PATTERN = /^\d{4}$/;

/** Branch manager: all drivers (not managers), active and disabled. */
export async function GET() {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('drivers')
    .select('id, name, active, role, created_at')
    .eq('role', 'driver')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[driver/manage/drivers] list failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

/** Branch manager: add a driver (name + 4-digit code). Managers can only create drivers. */
export async function POST(request: Request) {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim().slice(0, 80);
  const pin = String(body?.pin ?? '').trim();
  if (!name) return NextResponse.json({ error: 'יש להזין שם' }, { status: 400 });
  if (!PIN_PATTERN.test(pin)) return NextResponse.json({ error: 'הקוד חייב להיות 4 ספרות' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('drivers')
    .insert({ name, pin_hash: await bcrypt.hash(pin, 10), role: 'driver' })
    .select('id, name, active, role, created_at')
    .single();
  if (error) {
    console.error('[driver/manage/drivers] insert failed:', error.message);
    return NextResponse.json({ error: 'הוספת הנהג נכשלה' }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
