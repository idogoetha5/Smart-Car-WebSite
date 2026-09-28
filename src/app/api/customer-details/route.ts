import { NextResponse } from 'next/server';
import { getBranch, type BranchId } from '@/lib/branches';
import { checkRateLimit } from '@/lib/ratelimit';
import { readJsonBody } from '@/lib/request-body';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyTurnstile } from '@/lib/turnstile';
import { customerDetailsSchema, type CustomerDetailsInput } from '@/lib/validations';
import { numericOrderReference } from '@/lib/order-reference';

const BRANCH_EMAIL_ENV: Record<BranchId, string> = {
  herzliya: 'CUSTOMER_FORMS_EMAIL_HERZLIYA',
  telaviv: 'CUSTOMER_FORMS_EMAIL_TELAVIV',
  jerusalem: 'CUSTOMER_FORMS_EMAIL_JERUSALEM',
  airport: 'CUSTOMER_FORMS_EMAIL_AIRPORT',
};

function escapeHtml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

// Temporary: office email notifications are OFF while the admin panel is the source of truth.
// Flip this to true (or remove the guard below) once branch emails should resume.
const EMAIL_NOTIFICATIONS_ENABLED = false;

function branchRecipient(branchId: BranchId): string {
  const configured = process.env[BRANCH_EMAIL_ENV[branchId]]?.trim();
  return configured || process.env.CUSTOMER_FORMS_EMAIL_FALLBACK?.trim() || 'office@smartcar.co.il';
}

async function notifyBranch(id: string, value: CustomerDetailsInput): Promise<boolean> {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey || !privateKey) return false;

  const branch = getBranch(value.branchId);
  const recipient = branchRecipient(value.branchId);
  const summary = [
    `New customer form — ${branch.nameEn} / ${branch.nameHe}`,
    `Reference: ${id}`,
    '',
    `Full name: ${value.fullName}`,
    `Date of birth: ${value.dateOfBirth}`,
    `ID / passport number: ${value.passportNumber}`,
    `Driving licence number: ${value.driverLicenseNumber}`,
    `City and country: ${[value.city, value.country].filter(Boolean).join(', ')}`,
    `Home address: ${value.address}`,
    `Phone: ${value.phone}`,
    `Address in Israel: ${value.israelAddress || '-'}`,
    `Email: ${value.email}`,
    `Invoice and delayed-charge notice accepted: Yes`,
  ].join('\n');

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: recipient,
          to_name: `${branch.nameHe} – SmartCar`,
          reply_to: escapeHtml(value.email),
          booking_type: `טופס לקוח חדש – ${branch.nameHe}`,
          vehicle_name: `טופס ${escapeHtml(id)} – ${escapeHtml(value.fullName)}`,
          order_id: numericOrderReference(id),
          start_date: value.dateOfBirth,
          end_date: '-',
          pickup_location: escapeHtml([value.address, value.city, value.country].filter(Boolean).join(', ')),
          return_location: escapeHtml(value.israelAddress || '-'),
          customer_phone: escapeHtml(value.phone),
          total_price: '-',
          message: escapeHtml(summary),
          bcc_email: recipient,
          logo_url: 'https://iovpoxmdsgsstaduggvb.supabase.co/storage/v1/object/public/vehicles/logo.png',
        },
      }),
    });
    if (!response.ok) console.error('[customer-details] branch notification rejected (ref %s, status %s)', id, response.status);
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { success, retryAfter } = await checkRateLimit(`customer-details:${ip}`, 10, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(retryAfter ?? 60) } });
  }

  const raw = await readJsonBody(request);
  if (!raw.ok) return NextResponse.json({ error: raw.error }, { status: raw.status });
  if (raw.value._website) return NextResponse.json({ data: { id: 'received' } }, { status: 201 });

  if (!await verifyTurnstile(typeof raw.value.turnstileToken === 'string' ? raw.value.turnstileToken : undefined)) {
    return NextResponse.json({ error: 'Anti-bot verification failed.' }, { status: 400 });
  }

  const parsed = customerDetailsSchema.safeParse(raw.value);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid details' }, { status: 400 });
  }

  const value = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('customer_details_forms')
    .insert({
      branch_id: value.branchId,
      full_name: value.fullName,
      date_of_birth: value.dateOfBirth,
      passport_number: value.passportNumber,
      driver_license_number: value.driverLicenseNumber,
      country: value.country,
      city: value.city,
      address: value.address,
      postal_code: value.postalCode || null,
      phone: value.phone,
      israel_address: value.israelAddress || null,
      email: value.email,
      locale: value.locale,
      invoice_notice_accepted_at: new Date().toISOString(),
      source: 'branch_qr',
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    console.error('[customer-details] insert failed:', error?.message ?? 'missing row');
    return NextResponse.json({ error: 'Could not save customer details.' }, { status: 503 });
  }

  const branchNotified = EMAIL_NOTIFICATIONS_ENABLED ? await notifyBranch(data.id, value) : false;
  if (EMAIL_NOTIFICATIONS_ENABLED && !branchNotified) console.error('[customer-details][ALERT] form saved but branch notification failed (ref %s)', data.id);

  return NextResponse.json({ data: { id: data.id, createdAt: data.created_at }, branchNotified }, { status: 201 });
}
