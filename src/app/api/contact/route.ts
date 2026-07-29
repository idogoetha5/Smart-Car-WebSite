import { NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/server';
import { contactSchema } from '@/lib/validations';
import { readJsonBody } from '@/lib/request-body';

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

  const raw = await readJsonBody(request);
  if (!raw.ok) {
    return NextResponse.json({ error: raw.error }, { status: raw.status });
  }

  // Turnstile first, so a bot never reaches the validator or the database.
  const rawBody = raw.value as Record<string, unknown>;
  if (!await verifyTurnstile(typeof rawBody.turnstileToken === 'string' ? rawBody.turnstileToken : undefined)) {
    return NextResponse.json({ error: 'אימות אנטי-בוט נכשל. נסה שנית.' }, { status: 400 });
  }

  // Hidden field — a real person never fills it in.
  if (rawBody._website) {
    return NextResponse.json({ success: true, notified: false });
  }

  const parsed = contactSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'פרטי הפנייה אינם תקינים' },
      { status: 400 }
    );
  }

  // Only validated values from here on — the raw body is not read again.
  const { name, phone, message } = parsed.data;
  const email = parsed.data.email ?? '';

  // Save the lead BEFORE attempting the notification email — an email
  // provider outage must never lose a customer inquiry. If the table
  // doesn't exist yet (scripts/add-consent-ledger-columns.sql not run),
  // log loudly and continue so the notification still goes out.
  // Saving the lead is the operation. It used to be attempted, logged on
  // failure and then ignored, so the API could answer "sent" with nothing
  // recorded anywhere — the enquiry existed only as an email that may or may
  // not have arrived. A lead we cannot store is a lead we will lose.
  try {
    const supabase = createAdminClient();
    const { error: dbError } = await supabase
      .from('contact_leads')
      .insert({ name, phone, email: email || null, message });
    if (dbError) {
      console.error('[contact] lead insert failed:', dbError.message);
      return NextResponse.json(
        { error: 'לא הצלחנו לשמור את הפנייה. אנא נסו שוב או צרו קשר בטלפון.' },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error('[contact] lead insert error:', err);
    return NextResponse.json(
      { error: 'לא הצלחנו לשמור את הפנייה. אנא נסו שוב או צרו קשר בטלפון.' },
      { status: 503 }
    );
  }

  const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    // The lead is stored; only the notification is unavailable.
    console.error('[contact][ALERT] EmailJS not configured — lead saved, team not notified');
    return NextResponse.json({ success: true, notified: false });
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
      // The lead is already stored. Telling the customer it failed makes them
      // send again and creates a duplicate, while the team sees the enquiry
      // either way. [ALERT] so the missing notification is findable.
      console.error('[contact][ALERT] notification failed after lead was saved:', emailRes.status, await emailRes.text().catch(() => ''));
      return NextResponse.json({ success: true, notified: false });
    }
  } catch (err) {
    console.error('[contact][ALERT] notification error after lead was saved:', err);
    return NextResponse.json({ success: true, notified: false });
  }

  return NextResponse.json({ success: true, notified: true });
}
