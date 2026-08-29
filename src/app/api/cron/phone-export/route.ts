import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server';
import { OFFICE_EMAIL } from '@/lib/constants';

/**
 * Every ~3 days (see the `crons` entry in vercel.json), collects every
 * phone number entered on the site in the last 7 days — bookings, leasing
 * inquiries, contact-form leads and WhatsApp rental requests — into one
 * CSV and emails it to the office. The 7-day window deliberately
 * overlaps the 3-day cadence so a missed or delayed run never drops a
 * lead; office@smartcar.co.il only needs to skim for numbers it has
 * already seen twice.
 *
 * This is in addition to the existing per-lead notification emails, not a
 * replacement — it exists for a bulk follow-up sweep.
 *
 * Vercel signs cron-triggered requests with `Authorization: Bearer
 * $CRON_SECRET` — this route refuses everything else, same as
 * src/app/api/cron/email-retry.
 */

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface ExportRow {
  source: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  details: string;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: ExportRow[]): string {
  const header = ['מקור', 'שם', 'טלפון', 'אימייל', 'תאריך', 'פרטים'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [row.source, row.name, row.phone, row.email, row.createdAt, row.details]
        .map(csvCell)
        .join(',')
    );
  }
  // UTF-8 BOM so Excel renders Hebrew correctly instead of mojibake.
  return '﻿' + lines.join('\r\n');
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const supabase = createAdminClient();

  const [bookings, leasing, contacts, whatsapp] = await Promise.all([
    supabase
      .from('bookings')
      .select('customer_name, customer_phone, customer_email, pickup_location, dropoff_location, created_at')
      .gte('created_at', since),
    supabase
      .from('leasing_requests')
      .select('customer_name, customer_phone, customer_email, created_at')
      .gte('created_at', since),
    supabase
      .from('contact_leads')
      .select('name, phone, email, message, created_at')
      .gte('created_at', since),
    supabase
      .from('whatsapp_rental_requests')
      .select('customer_name, phone, customer_email, pickup_location, dropoff_location, created_at')
      .gte('created_at', since),
  ]);

  for (const [label, result] of [
    ['bookings', bookings],
    ['leasing_requests', leasing],
    ['contact_leads', contacts],
    ['whatsapp_rental_requests', whatsapp],
  ] as const) {
    if (result.error) {
      console.error(`[phone-export] failed to read ${label}:`, result.error.message);
    }
  }

  const rows: ExportRow[] = [
    ...(bookings.data ?? []).map((b) => ({
      source: 'השכרה',
      name: b.customer_name ?? '',
      phone: b.customer_phone ?? '',
      email: b.customer_email ?? '',
      createdAt: b.created_at,
      details: `${b.pickup_location ?? ''} → ${b.dropoff_location ?? ''}`,
    })),
    ...(leasing.data ?? []).map((l) => ({
      source: 'ליסינג',
      name: l.customer_name ?? '',
      phone: l.customer_phone ?? '',
      email: l.customer_email ?? '',
      createdAt: l.created_at,
      details: '',
    })),
    ...(contacts.data ?? []).map((c) => ({
      source: 'צור קשר',
      name: c.name ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      createdAt: c.created_at,
      details: c.message ?? '',
    })),
    ...(whatsapp.data ?? []).map((w) => ({
      source: 'וואטסאפ',
      name: w.customer_name ?? '',
      phone: w.phone ?? '',
      email: w.customer_email ?? '',
      createdAt: w.created_at,
      details: `${w.pickup_location ?? ''} → ${w.dropoff_location ?? ''}`,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[phone-export][ALERT] Resend is not configured — export not sent');
    return NextResponse.json({ success: false, error: 'Resend not configured' }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `SmartCar <${OFFICE_EMAIL}>`,
    to: OFFICE_EMAIL,
    subject: `יצוא מספרי טלפון — ${today} (${rows.length} רשומות, 7 ימים אחרונים)`,
    html: `<p>מצורף קובץ עם ${rows.length} מספרי טלפון שהוכנסו באתר ב-7 הימים האחרונים (השכרה, ליסינג, צור קשר, וואטסאפ).</p>`,
    text: `מצורף קובץ עם ${rows.length} מספרי טלפון שהוכנסו באתר ב-7 הימים האחרונים.`,
    attachments: [
      {
        content: Buffer.from(toCsv(rows), 'utf-8'),
        filename: `phone-export-${today}.csv`,
        contentType: 'text/csv',
      },
    ],
    tags: [{ name: 'category', value: 'phone-export' }],
  });

  if (error) {
    console.error('[phone-export][ALERT] send failed:', error.name, error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ success: true, rows: rows.length });
}
