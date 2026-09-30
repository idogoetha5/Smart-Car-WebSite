import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/server';
import { driversWithPush } from '@/lib/push';
import { verifyAdminToken } from '@/lib/admin-auth';

const PIN_PATTERN = /^\d{4}$/;

export async function GET() {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('drivers')
    .select('id, name, active, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/drivers] list failed:', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  const withPush = await driversWithPush();
  return NextResponse.json({ data: (data ?? []).map((d) => ({ ...d, pushEnabled: withPush.has(d.id) })) });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  const pin = String(body?.pin ?? '').trim();
  const role = body?.role === 'manager' ? 'manager' : 'driver';

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!PIN_PATTERN.test(pin)) {
    return NextResponse.json({ error: 'הקוד חייב להיות 4 ספרות' }, { status: 400 });
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('drivers')
    .insert(role === 'manager' ? { name, pin_hash: pinHash, role } : { name, pin_hash: pinHash })
    .select('id, name, active, role, created_at')
    .single();

  if (error) {
    console.error('[admin/drivers] insert failed:', error.message);
    return NextResponse.json({ error: 'Failed to create driver' }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
