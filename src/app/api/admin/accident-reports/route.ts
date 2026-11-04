import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from('accident_reports')
    .select('id, status, car_plate, car_model, driver_name, driver_phone, accident_date, other_vehicle, branch, email_sent, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
  return NextResponse.json({ data });
}
