import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

const PIN_PATTERN = /^\d{4}$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const update: Record<string, unknown> = {};

  if (typeof body?.active === 'boolean') update.active = body.active;
  if (typeof body?.name === 'string' && body.name.trim()) update.name = body.name.trim();
  if (typeof body?.pin === 'string' && body.pin.trim()) {
    if (!PIN_PATTERN.test(body.pin.trim())) {
      return NextResponse.json({ error: 'הקוד חייב להיות 4 ספרות' }, { status: 400 });
    }
    update.pin_hash = await bcrypt.hash(body.pin.trim(), 10);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('drivers')
    .update(update)
    .eq('id', id)
    .select('id, name, active, created_at')
    .maybeSingle();

  if (error) {
    console.error('[admin/drivers/[id]] update failed:', error.message);
    return NextResponse.json({ error: 'Failed to update driver' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }
  return NextResponse.json({ data });
}
