import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { alreadyDelivered, sendTemplateEmail } from '@/lib/email-delivery';
import { formatLocationForCustomer } from '@/lib/location-display';

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
  insurance: '🛡️ הפחתה או ביטול השתתפות בנזק',
  highway6:  '🛣️ חבילת כביש 6 ומנהרות',
  baby_seat: '👶 כיסא בטיחות לילד',
  driver:    '👤 נהג נוסף',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function whatsappDepositLink(orderId: string): string {
  const text = `שלום, אני רוצה לשלם מקדמה עבור ההזמנה שלי מספר #${orderId}`;
  return `https://wa.me/97299509757?text=${encodeURIComponent(text)}`;
}

/** Only the fields the confirmation template actually reads. */
interface ConfirmableBooking {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  pickup_date: string;
  dropoff_date: string;
  pickup_time?: string | null;
  return_time?: string | null;
  pickup_location: string;
  dropoff_location: string;
  total_price?: number | string | null;
  extras?: string[] | null;
  vehicle?: { make?: string; model?: string } | null;
}

/** Returns whether the customer actually got the mail. */
async function sendConfirmationEmail(booking: ConfirmableBooking): Promise<boolean> {
  // The RPC guarantees only one caller performs the transition, so this
  // runs once per booking. The idempotency key is belt-and-braces: it also
  // survives a redeploy or a manual re-run of the same approval.
  const key = `booking_confirmed:${booking.id}`;
  if (await alreadyDelivered(key)) {
    console.info('[admin/bookings] confirmation already delivered, skipping (ref %s)', key);
    // Already delivered on an earlier attempt — from the customer's side this
    // is a success, not a skipped send.
    return true;
  }

  const result = await sendTemplateEmail({
    event: 'booking_confirmed',
    idempotencyKey: key,
    templateId: process.env.NEXT_PUBLIC_EMAILJS_CONFIRMATION_TEMPLATE_ID,
    params: {
          to_email:          booking.customer_email,
          to_name:           booking.customer_name,
          order_id:          String(booking.id).slice(0, 8).toUpperCase(),
          booking_type:      'השכרה',
          vehicle_name:      `${booking.vehicle?.make ?? ''} ${booking.vehicle?.model ?? ''}`.trim(),
          start_date:        formatDate(booking.pickup_date),
          end_date:          formatDate(booking.dropoff_date),
          // The confirmation template was missing collection and return
          // times, so a customer could not tell when to be there.
          pickup_time:       booking.pickup_time || '09:00',
          return_time:       booking.return_time || '09:00',
          pickup_location:   formatLocationForCustomer(booking.pickup_location),
          return_location:   formatLocationForCustomer(booking.dropoff_location),
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
  });

  return result.ok;
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
  let confirmationEmailed: boolean | null = null;
  if (transitionedToConfirmed) {
    // The result used to be discarded, so the API answered "success" and the
    // admin screen showed a confirmed booking even when the customer received
    // nothing — at the exact point the customer is told a deposit is due.
    // The approval itself stands regardless; it is already committed.
    confirmationEmailed = await sendConfirmationEmail(booking);
    if (!confirmationEmailed) {
      console.error('[admin/bookings][ALERT] booking confirmed but confirmation email failed:', id);
    }
  }

  return NextResponse.json({ success: true, booking, confirmationEmailed });
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
