import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/ratelimit';
import { isValidInternationalPhone } from '@/lib/validations';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: rlOk } = await checkRateLimit(`leasing-inquiry:${ip}`, 10, 60 * 60 * 1000);
  if (!rlOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > 8192) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const body = await request.json();

  // Honeypot
  if (body._hp) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (!await verifyTurnstile(body.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  const name = String(body.customer_name ?? '').trim();
  const phone = String(body.customer_phone ?? '').trim();
  const email = String(body.customer_email ?? '').trim();
  if (!name || name.length < 2 || !phone) {
    return NextResponse.json({ error: 'שם וטלפון הם שדות חובה' }, { status: 400 });
  }
  if (!isValidInternationalPhone(phone)) {
    return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 });
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'כתובת אימייל לא תקינה' }, { status: 400 });
  }

  // createAdminClient (service role) bypasses RLS — safe here as this is server-only code
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('leasing_requests')
    .insert([{
      customer_name:     name,
      customer_phone:    phone,
      customer_email:    email || null,
      vehicle_id:        body.vehicle_id || null,
      notes:             body.notes || null,
      duration_months:   body.duration_months ?? 36,
      mileage_package:   body.mileage_package ?? 15000,
      estimated_monthly: body.estimated_monthly ?? 0,
      down_payment:      0,
      status:            'PENDING',
    }])
    .select()
    .single();

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }

  return NextResponse.json({ data }, { status: 201 });
}
