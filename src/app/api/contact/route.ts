import { NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/server';

function escapeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit, retryAfter } = await checkRateLimit(`contact:${ip}`, 5, 60 * 60 * 1000);
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'יותר מדי בקשות. נסה שוב מאוחר יותר.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const body = await request.json();
  const name    = String(body.name ?? '').trim().slice(0, 100);
  const phone   = String(body.phone ?? '').trim().slice(0, 30);
  const email   = String(body.email ?? '').trim().slice(0, 200);
  const message = String(body.message ?? '').trim().slice(0, 4000);

  if (!name || !phone || !message) {
    return NextResponse.json({ error: 'שם, טלפון והודעה הם שדות חובה' }, { status: 400 });
  }

  if (!await verifyTurnstile(body.turnstileToken)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  // Save the lead BEFORE attempting the notification email — an email
  // provider outage must never lose a customer inquiry. If the table
  // doesn't exist yet (scripts/add-consent-ledger-columns.sql not run),
  // log loudly and continue so the notification still goes out.
  try {
    const supabase = createAdminClient();
    const { error: dbError } = await supabase
      .from('contact_leads')
      .insert({ name, phone, email: email || null, message });
    if (dbError) console.error('[contact] lead insert failed:', dbError.message);
  } catch (err) {
    console.error('[contact] lead insert error:', err);
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
          // Lead notification goes to a FIXED internal address — the
          // customer-supplied email is used only as reply_to and shown in
          // the body, never as the recipient (prevents using this endpoint
          // as an open email relay to arbitrary addresses).
          to_email:        'office@smartcar.co.il',
          reply_to:        escapeHtml(email),
          to_name:         'צוות SmartCar',
          booking_type:    'פנייה מהאתר',
          vehicle_name:    escapeHtml(`${message}\n\n— פרטי הפונה: ${name} | ${phone}${email ? ` | ${email}` : ''}`),
          order_id:        Date.now().toString().slice(-8),
          start_date:      '-',
          end_date:        '-',
          pickup_location: '-',
          return_location: '-',
          customer_phone:  escapeHtml(phone),
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
