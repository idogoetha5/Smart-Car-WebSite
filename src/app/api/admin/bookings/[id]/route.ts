import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdminToken } from '@/lib/admin-auth';

const LOGO_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
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
          to_email:        booking.customer_email,
          to_name:         booking.customer_name,
          order_id:        String(booking.id).slice(0, 8).toUpperCase(),
          booking_type:    'השכרה',
          vehicle_name:    `${booking.vehicle?.make ?? ''} ${booking.vehicle?.model ?? ''}`.trim(),
          start_date:      formatDate(booking.pickup_date),
          end_date:        formatDate(booking.dropoff_date),
          pickup_location: booking.pickup_location,
          return_location: booking.dropoff_location,
          customer_phone:  booking.customer_phone,
          total_price:     booking.total_price ? `₪${Number(booking.total_price).toLocaleString()}` : '-',
          deposit_amount:  booking.vehicle?.deposit_amount ? `₪${Number(booking.vehicle.deposit_amount).toLocaleString()}` : '-',
          bcc_email:       'office@smartcar.co.il',
          logo_url:        LOGO_URL,
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

  const { data: before } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', id)
    .single();

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: dbStatus })
    .eq('id', id)
    .select('id, status');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: rows, error: fetchError } = await supabase
    .from('bookings')
    .select('*, vehicle:vehicles(make, model, year, deposit_amount)')
    .eq('id', id)
    .limit(1);

  if (fetchError || !rows || rows.length === 0) {
    return NextResponse.json({ error: 'Booking not found after update' }, { status: 500 });
  }

  // Only send the "booking confirmed — deposit due" email on the
  // transition INTO confirmed, not on every PATCH (e.g. later marking
  // it active/completed), so the customer never gets it twice.
  if (dbStatus === 'CONFIRMED' && before?.status !== 'CONFIRMED') {
    await sendConfirmationEmail(rows[0]);
  }

  return NextResponse.json({ success: true, booking: rows[0] });
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
