import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

const LOGO_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png';

// TEMPORARY (2026-07-20): there is no working online payment link yet.
// HYP_TERMINAL/HYP_PASSP/HYP_REFERER exist in Vercel (Hyp/YaadPay clearing
// credentials) but the integration needs a HYP_KEY we don't have, plus
// real testing in Hyp's sandbox before it touches real money — not
// something to guess and ship. Once that's built, this should generate
// a real Hyp hosted-payment-page link instead, AND the "Post-transaction
// address" callback URLs must be reconfigured in the Hyp Portal to point
// at the final smartcar.co.il domain (not this Vercel one) once the
// domain migration lands — see smartcar_icloud_git_corruption.md memory.
const EXTRAS_LABELS_HE: Record<string, string> = {
  insurance: '🛡️ ביטול השתתפות עצמית',
  highway6:  '🛣️ כביש 6',
  baby_seat: '👶 כיסא בטיחות',
  driver:    '👤 נהג נוסף',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function whatsappDepositLink(orderId: string): string {
  const text = `שלום, אני רוצה לשלם מקדמה עבור ההזמנה שלי מספר #${orderId}`;
  return `https://wa.me/97299509757?text=${encodeURIComponent(text)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendConfirmationEmail(booking: any) {
  const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_CONFIRMATION_TEMPLATE_ID;
  const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error('[admin/bookings] EmailJS confirmation template not configured — confirmation email not sent');
    return;
  }

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
          to_email:          booking.customer_email,
          to_name:           booking.customer_name,
          order_id:          String(booking.id).slice(0, 8).toUpperCase(),
          booking_type:      'השכרה',
          vehicle_name:      `${booking.vehicle?.make ?? ''} ${booking.vehicle?.model ?? ''}`.trim(),
          start_date:        formatDate(booking.pickup_date),
          end_date:          formatDate(booking.dropoff_date),
          pickup_location:   booking.pickup_location,
          return_location:   booking.dropoff_location,
          customer_phone:    booking.customer_phone,
          total_price:       booking.total_price ? `₪${Number(booking.total_price).toLocaleString()}` : '-',
          extras:            Array.isArray(booking.extras) && booking.extras.length > 0
                                ? booking.extras.map((e: string) => EXTRAS_LABELS_HE[e] ?? e).join(', ')
                                : 'ללא',
          down_payment:      booking.total_price ? `₪${Math.round(Number(booking.total_price) * 0.05).toLocaleString()}` : '-',
          payment_link:      whatsappDepositLink(String(booking.id).slice(0, 8).toUpperCase()),
          payment_link_text: whatsappDepositLink(String(booking.id).slice(0, 8).toUpperCase()),
          bcc_email:         'office@smartcar.co.il',
          logo_url:          LOGO_URL,
        },
      }),
    });
    if (!res.ok) {
      console.error('[admin/bookings] confirmation email send failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[admin/bookings] confirmation email error:', err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await request.json();

  const ALLOWED: Record<string, string> = {
    pending: 'PENDING', confirmed: 'CONFIRMED',
    cancelled: 'CANCELLED', active: 'ACTIVE', completed: 'COMPLETED',
    cancelled_by_customer: 'CANCELLED_BY_CUSTOMER',
    PENDING: 'PENDING', CONFIRMED: 'CONFIRMED',
    CANCELLED: 'CANCELLED', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED',
    CANCELLED_BY_CUSTOMER: 'CANCELLED_BY_CUSTOMER',
  };
  const dbStatus = ALLOWED[status];
  if (!dbStatus) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: current, error: currentError } = await supabase
    .from('bookings')
    .select('*, vehicle:vehicles(make, model, year, deposit_amount, total_units)')
    .eq('id', id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  let transitionedToConfirmed = false;

  if (dbStatus === 'CONFIRMED') {
    // Availability re-check and the transition into CONFIRMED happen in a
    // single database transaction (see scripts/add-approve-booking-rpc.sql).
    // Doing the count here and the UPDATE separately let two concurrent
    // approvals for the same vehicle both pass the check and oversell it.
    const { data: rpcRows, error: rpcError } = await supabase
      .rpc('approve_booking', { p_booking_id: id });

    if (rpcError) {
      console.error('[admin/bookings] approve_booking failed:', rpcError.message);
      return NextResponse.json({ error: 'שגיאה בבדיקת זמינות, נסה שוב' }, { status: 500 });
    }

    const outcome = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

    switch (outcome?.result) {
      case 'CONFIRMED':
        // Only the request that actually performed the transition gets
        // here, so a double-click or retry cannot send a second email.
        transitionedToConfirmed = true;
        break;
      case 'ALREADY_CONFIRMED':
        transitionedToConfirmed = false;
        break;
      case 'NO_UNITS':
        return NextResponse.json(
          { error: 'לא ניתן לאשר: כל היחידות של רכב זה כבר מאושרות להזמנות חופפות בתאריכים אלה' },
          { status: 409 }
        );
      case 'NOT_FOUND':
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      case 'VEHICLE_NOT_FOUND':
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
      default:
        console.error('[admin/bookings] unexpected approve_booking result:', outcome?.result);
        return NextResponse.json({ error: 'שגיאה בבדיקת זמינות, נסה שוב' }, { status: 503 });
    }
  } else {
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: dbStatus })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const booking = { ...current, status: dbStatus };

  // "Booking confirmed — deposit due" email: sent exactly once, only by
  // the request that performed the transition into CONFIRMED.
  if (transitionedToConfirmed) {
    await sendConfirmationEmail(booking);
  }

  return NextResponse.json({ success: true, booking });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) { console.error(error.message); return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
