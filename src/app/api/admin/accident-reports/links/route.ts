import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { digits, formatPlate } from '@/lib/accident-report/schema';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** Creates a personal, pre-filled link (valid 7 days) to send the customer over WhatsApp. */
export async function POST(request: Request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const token = randomBytes(18).toString('base64url');
  const plate = s(body.plate, 20);

  const { error } = await createAdminClient().from('accident_report_links').insert({
    token,
    car_plate: plate ? formatPlate(plate) : null,
    car_model: s(body.model, 80) || null,
    driver_name: s(body.name, 120) || null,
    driver_phone: s(body.phone, 20) || null,
    driver_id: digits(s(body.idNumber, 12)) || null,
    branch: s(body.branch, 40) || null,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
  return NextResponse.json({ token });
}
