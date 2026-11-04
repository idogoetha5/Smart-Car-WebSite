import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { digits, formatPlate } from '@/lib/accident-report/schema';

/**
 * Plate → model of a SmartCar vehicle.
 * 1. The fleet table (vehicles).
 * 2. Otherwise the model a customer typed in an earlier accident report for the same plate,
 *    so every report "teaches" the form. Test reports are ignored.
 * Returns { model: null } when nothing is known.
 */
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = await checkRateLimit(`accident-lookup:${ip}`, 30, 10 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ model: null }, { status: 429 });

  const plate = new URL(request.url).searchParams.get('plate') ?? '';
  const d = digits(plate);
  if (d.length < 5 || d.length > 8) return NextResponse.json({ model: null });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('vehicles')
    .select('make, model, year')
    .in('license_plate', [d, formatPlate(d)])
    .limit(1)
    .maybeSingle();

  const fleetModel = data ? [data.make, data.model, data.year].filter(Boolean).join(' ') : null;
  if (fleetModel) return NextResponse.json({ model: fleetModel });

  const { data: prev } = await supabase
    .from('accident_reports')
    .select('car_model')
    .in('car_plate', [formatPlate(d), d])
    .not('car_model', 'is', null)
    .neq('car_model', '')
    .not('driver_name', 'ilike', '%בדיקת מערכת%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ model: prev?.car_model?.trim() || null });
}
