import emailjs from '@emailjs/browser';

const SERVICE_ID  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID  ?? '';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? '';
const PUBLIC_KEY  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY  ?? '';

function emailjsConfigured(): boolean {
  return !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

function capitalize(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function sendBookingEmail({
  customerName,
  customerEmail,
  customerPhone,
  vehicleName,
  startDate,
  endDate,
  pickupLocation,
  returnLocation,
  bookingType,
  totalPrice,
  bookingId,
  pickupTime,
  returnTime,
}: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
  pickupLocation: string;
  returnLocation?: string;
  bookingType: 'השכרה' | 'ליסינג' | 'קניית רכב';
  totalPrice?: number;
  bookingId: string;
  pickupTime?: string;
  returnTime?: string;
}) {
  const templateParams = {
    to_email:        customerEmail,
    to_name:         customerName,
    order_id:        bookingId.slice(0, 8).toUpperCase(),
    booking_type:    bookingType,
    vehicle_name:    vehicleName,
    start_date:      formatDate(startDate),
    end_date:        formatDate(endDate),
    pickup_location: capitalize(pickupLocation),
    return_location: capitalize(returnLocation || pickupLocation),
    customer_phone:  customerPhone,
    total_price:     totalPrice ? `₪${totalPrice.toLocaleString()}` : 'יצור קשר לפרטים',
    bcc_email:       'office@smartcar.co.il',
    pickup_time:     pickupTime || '09:00',
    return_time:     returnTime || '09:00',
    logo_url:        'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png',
  };

  if (!emailjsConfigured()) return;
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
}

export async function sendNewsletterSubscribeEmail(subscriberEmail: string) {
  const templateParams = {
    to_email:        subscriberEmail,
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
  };

  if (!emailjsConfigured()) return;
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
}

export async function sendContactEmail({
  customerName,
  customerEmail,
  customerPhone,
  message,
  subject,
}: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  message: string;
  subject?: string;
}) {
  const templateParams = {
    to_email:        customerEmail,
    to_name:         customerName,
    booking_type:    'פנייה כללית',
    vehicle_name:    subject || 'פנייה מהאתר',
    order_id:        Date.now().toString().slice(-8),
    start_date:      '-',
    end_date:        '-',
    pickup_location: '-',
    return_location: '-',
    customer_phone:  customerPhone,
    total_price:     '-',
    message,
    logo_url:        'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png',
  };

  if (!emailjsConfigured()) return;
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
}
