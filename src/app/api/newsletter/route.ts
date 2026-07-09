import { NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/ratelimit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit, retryAfter } = await checkRateLimit(`newsletter:${ip}`, 5, 60_000);
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'כתובת אימייל לא תקינה' }, { status: 400 });
  }

  if (!await verifyTurnstile(body?.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error('[newsletter] EmailJS not fully configured — subscription not sent');
    return NextResponse.json(
      { error: 'שירות ההרשמה אינו זמין כרגע.' },
      { status: 503 }
    );
  }

  try {
    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:    serviceId,
        template_id:   templateId,
        user_id:       publicKey,
        accessToken:   privateKey,
        template_params: {
          to_email:        email,
          to_name:         'שלום',
          booking_type:    'הרשמה לניוזלטר מבצעים',
          vehicle_name:    'SmartCar — מבצעים ועדכונים',
          order_id:        Date.now().toString().slice(-8),
          start_date:      new Date().toLocaleDateString('he-IL'),
          end_date:        '-',
          pickup_location: '-',
          return_location: '-',
          customer_phone:  '-',
          total_price:     '-',
          bcc_email:       'deals@smartcar.co.il',
          logo_url:        'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png',
        },
      }),
    });
    if (!emailRes.ok) {
      console.error('[newsletter] EmailJS send failed:', emailRes.status, await emailRes.text().catch(() => ''));
      return NextResponse.json({ error: 'ההרשמה נכשלה, נסה שנית' }, { status: 502 });
    }
  } catch (err) {
    console.error('[newsletter] EmailJS error:', err);
    return NextResponse.json({ error: 'ההרשמה נכשלה, נסה שנית' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
