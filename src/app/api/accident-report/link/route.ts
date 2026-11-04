import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/** Pre-fill data for a personal link sent over WhatsApp. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(token)) return NextResponse.json({ valid: false });

  const { data } = await createAdminClient()
    .from('accident_report_links')
    .select('car_plate, car_model, driver_name, driver_phone, driver_id, branch, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (!data || data.used_at || new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false });
  }
  return NextResponse.json({
    valid: true,
    plate: data.car_plate ?? '',
    model: data.car_model ?? '',
    name: data.driver_name ?? '',
    phone: data.driver_phone ?? '',
    idNumber: data.driver_id ?? '',
    branch: data.branch ?? '',
  });
}
