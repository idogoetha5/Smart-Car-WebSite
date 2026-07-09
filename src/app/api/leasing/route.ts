import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/ratelimit';
import { isValidInternationalPhone } from '@/lib/validations';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function checkAdminAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function GET() {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('leasing_requests')
    .select(`*, vehicle:vehicles(make, model, year)`)
    .order('created_at', { ascending: false });

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: rlOk } = await checkRateLimit(`leasing:${ip}`, 10, 60 * 60 * 1000);
  if (!rlOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const body = await request.json();

  // Honeypot
  if (body._hp) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (!await verifyTurnstile(body.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  const customerName  = String(body.customer_name ?? body.customerName ?? '').trim();
  const customerPhone = String(body.customer_phone ?? body.customerPhone ?? '').trim();
  const customerEmail = String(body.customer_email ?? body.customerEmail ?? '').trim();

  if (!customerName || customerName.length < 2) {
    return NextResponse.json({ error: 'שם מלא הוא שדה חובה' }, { status: 400 });
  }
  if (!customerPhone || !isValidInternationalPhone(customerPhone)) {
    return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 });
  }
  if (customerEmail && !EMAIL_RE.test(customerEmail)) {
    return NextResponse.json({ error: 'כתובת אימייל לא תקינה' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Allowlist only known fields — never pass raw body to Supabase
  const allowedData = {
    customer_name:    customerName,
    customer_phone:   customerPhone,
    customer_email:   customerEmail || null,
    vehicle_id:       body.vehicle_id ?? null,
    duration_months:  Number(body.duration ?? body.duration_months) || 36,
    mileage_package:  Number(body.mileage_package ?? body.mileagePackage) || 15000,
    company_name:     String(body.company_name ?? body.companyName ?? '').trim() || null,
    notes:            String(body.notes ?? '').trim() || null,
    status:           'PENDING',
  };

  const { data, error } = await supabase
    .from('leasing_requests')
    .insert([allowedData])
    .select()
    .single();

  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }

  return NextResponse.json({ data }, { status: 201 });
}
