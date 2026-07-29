import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/ratelimit';
import { isValidInternationalPhone } from '@/lib/validations';
import { sendTemplateEmail } from '@/lib/email-delivery';
import { numericOrderReference } from '@/lib/order-reference';

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

  // The form told the customer "פנייתך התקבלה" while this route stored a row
  // and notified nobody. If the team was not watching the admin screen, a hot
  // lead could sit unseen indefinitely. The save above is still what decides
  // success — a failed alert must not make the customer send again — but the
  // alert now actually goes out.
  const notified = await sendTemplateEmail({
    event: 'contact_lead',
    idempotencyKey: `leasing_inquiry:${data.id}`,
    templateId: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
    params: {
      to_email: 'office@smartcar.co.il',
      to_name: 'צוות SmartCar',
      bcc_email: 'office@smartcar.co.il',
      reply_to: email || 'office@smartcar.co.il',
      booking_type: 'פניית ליסינג',
      order_id: numericOrderReference(String(data.id)),
      vehicle_name: `פניית ליסינג חדשה\n\nשם: ${name}\nטלפון: ${phone}${email ? `\nדוא"ל: ${email}` : ''}\nתקופה: ${body.duration_months ?? 36} חודשים\nחבילת ק"מ: ${body.mileage_package ?? 15000}${body.notes ? `\n\nהערות: ${String(body.notes).slice(0, 500)}` : ''}`,
      customer_phone: phone,
      start_date: '-',
      end_date: '-',
      pickup_location: '-',
      return_location: '-',
      total_price: '-',
      logo_url: 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png',
    },
  });

  if (!notified.ok) {
    console.error('[leasing/inquiry][ALERT] lead saved but team not notified:', data.id, notified.status);
  }

  // Minimal DTO — the row holds the lead's name, phone, email and notes, and
  // the UI only needs to know it was recorded.
  return NextResponse.json(
    { data: { id: data.id, status: data.status }, notified: notified.ok },
    { status: 201 },
  );
}
