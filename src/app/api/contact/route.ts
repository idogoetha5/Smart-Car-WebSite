import { NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';

function escapeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, phone, email, message } = body;

  if (!String(name ?? '').trim() || !String(phone ?? '').trim() || !String(message ?? '').trim()) {
    return NextResponse.json({ error: 'שם, טלפון והודעה הם שדות חובה' }, { status: 400 });
  }

  if (!await verifyTurnstile(body.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error('[contact] EmailJS not fully configured — message not sent');
    return NextResponse.json(
      { error: 'שירות שליחת ההודעות אינו זמין כרגע. אנא צרו קשר בטלפון.' },
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
          to_email:        escapeHtml(String(email ?? 'office@smartcar.co.il')),
          to_name:         escapeHtml(String(name ?? '')),
          booking_type:    'פנייה מהאתר',
          vehicle_name:    escapeHtml(String(message ?? '')),
          order_id:        Date.now().toString().slice(-8),
          start_date:      '-',
          end_date:        '-',
          pickup_location: '-',
          return_location: '-',
          customer_phone:  escapeHtml(String(phone ?? '')),
          total_price:     '-',
          bcc_email:       'office@smartcar.co.il',
          logo_url:        'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png',
        },
      }),
    });
    if (!emailRes.ok) {
      console.error('[contact] EmailJS send failed:', emailRes.status, await emailRes.text().catch(() => ''));
      return NextResponse.json(
        { error: 'שליחת ההודעה נכשלה. אנא נסו שוב או צרו קשר בטלפון.' },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error('[contact] EmailJS error:', err);
    return NextResponse.json(
      { error: 'שליחת ההודעה נכשלה. אנא נסו שוב או צרו קשר בטלפון.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
