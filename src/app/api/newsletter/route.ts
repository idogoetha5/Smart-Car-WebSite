import { NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { checkRateLimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/server';
import { marketingConsent } from '@/lib/consent';

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

  // Explicit consent is required — no implied opt-in. The wording itself is
  // NOT read from the request: a client could otherwise post any sentence and
  // have it filed as the customer's agreement, which would make a forged
  // ledger entry indistinguishable from a real one.
  if (body?.consent !== true) {
    return NextResponse.json(
      { error: 'יש לאשר את קבלת הדיוור כדי להירשם' },
      { status: 400 }
    );
  }

  // Server-derived from the verified locale.
  const consent = marketingConsent(body?.locale);

  const supabase = createAdminClient();

  // Suppression list: once someone unsubscribes we must not silently
  // re-add them from a stale form. They can re-subscribe only by a fresh
  // explicit consent, which is what this request is — so we record a new
  // consent event and clear the suppression, rather than ignoring it.
  try {
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('unsubscribed_at')
      .eq('email', email)
      .maybeSingle();

    // Consent ledger: store the exact wording shown, its version, when it
    // was given, from where, and in which language — so the consent can be
    // proven later rather than merely asserted.
    const { error: dbError } = await supabase
      .from('newsletter_subscribers')
      .upsert(
        {
          email,
          consent_at: new Date().toISOString(),
          consent_text: consent.text,
          consent_version: consent.version,
          locale: consent.locale,
          source: String(body.source ?? 'newsletter_form').slice(0, 50),
          // A fresh explicit consent lifts a previous unsubscribe.
          unsubscribed_at: null,
        },
        { onConflict: 'email' }
      );
    if (dbError) {
      // The consent ledger IS the subscription. Carrying on here meant the
      // API could report a successful signup, and a welcome email could go
      // out, with no record that the person ever agreed — which is precisely
      // the evidence the ledger exists to hold. Better to ask them to try
      // again than to mail someone we cannot prove consented.
      console.error('[newsletter] consent ledger write failed:', dbError.message);
      return NextResponse.json(
        { error: 'ההרשמה נכשלה, נסו שוב מאוחר יותר' },
        { status: 503 }
      );
    } else if (existing?.unsubscribed_at) {
      console.info('[newsletter] previously unsubscribed address re-subscribed with fresh consent');
    }
  } catch (err) {
    // Same reasoning as above: no ledger row, no subscription.
    console.error('[newsletter] consent ledger error:', err);
    return NextResponse.json(
      { error: 'ההרשמה נכשלה, נסו שוב מאוחר יותר' },
      { status: 503 }
    );
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
