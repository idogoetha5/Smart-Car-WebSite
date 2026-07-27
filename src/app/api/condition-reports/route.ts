import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';

function escapeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

async function notifyOffice(report: {
  id: string;
  bookingId: string;
  customerName: string;
  mileage: number | null;
  fuelLevel: string;
  damageList: string;
  notes: string;
}) {
  const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error('[condition-reports] EmailJS not configured — notification not sent for', report.id);
    return;
  }

  const summary = `דוח מצב רכב #${report.id}\nהזמנה: ${report.bookingId || '-'}\nלקוח: ${report.customerName}\nק"מ: ${report.mileage ?? '-'}\nדלק: ${report.fuelLevel}\nנזקים: ${report.damageList || 'אין'}\nהערות: ${report.notes || '-'}`;

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email:        'office@smartcar.co.il',
          to_name:         'צוות SmartCar',
          booking_type:    'דוח מצב רכב חדש',
          vehicle_name:    `דוח #${report.id}`,
          order_id:        report.bookingId || report.id.slice(0, 8),
          start_date:      '-',
          end_date:        '-',
          pickup_location: '-',
          return_location: '-',
          customer_phone:  '-',
          total_price:     '-',
          message:         escapeHtml(summary),
          bcc_email:       'office@smartcar.co.il',
          logo_url:        'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png',
        },
      }),
    });
    if (!res.ok) {
      console.error('[condition-reports] EmailJS notify failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[condition-reports] EmailJS notify error:', err);
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success: withinLimit, retryAfter } = await checkRateLimit(`condition-report:${ip}`, 5, 60 * 60 * 1000);
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } }
    );
  }

  const body = await request.json();
  const customerName = String(body.customerName ?? '').trim();
  if (!customerName) {
    return NextResponse.json({ error: 'שם הלקוח הוא שדה חובה' }, { status: 400 });
  }
  // Honeypot — bots fill hidden fields, humans don't
  if (body._website) {
    return NextResponse.json({ data: { id: 'bot' } }, { status: 201 });
  }

  const bookingId = String(body.bookingId ?? '').trim().toUpperCase();
  const mileage = body.mileage !== undefined && body.mileage !== '' ? Number(body.mileage) : null;
  const fuelLevel = String(body.fuelLevel ?? 'full');
  const damages: Record<string, boolean> = body.damages && typeof body.damages === 'object' ? body.damages : {};
  const notes = String(body.notes ?? '').trim();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('condition_reports')
    .insert({
      booking_id: bookingId || null,
      customer_name: customerName,
      mileage,
      fuel_level: fuelLevel,
      damages,
      notes: notes || null,
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('[condition-reports] insert failed:', error.message);
    return NextResponse.json({ error: 'שמירת הדוח נכשלה. נסה שוב או פנה למשרד.' }, { status: 500 });
  }

  const damageList = Object.entries(damages).filter(([, v]) => v).map(([k]) => k).join(', ');
  await notifyOffice({
    id: data.id,
    bookingId,
    customerName,
    mileage,
    fuelLevel,
    damageList,
    notes,
  });

  return NextResponse.json({ data: { id: data.id, createdAt: data.created_at } }, { status: 201 });
}
