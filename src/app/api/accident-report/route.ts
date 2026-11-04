import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { reportSchema, formatPlate, type StoredReport } from '@/lib/accident-report/schema';
import { generateAccidentReportHTML, renderPdf } from '@/lib/accident-report/pdf';
import { sendReportEmails } from '@/lib/accident-report/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'accident-reports';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = await checkRateLimit(`accident-report:${ip}`, 5, 10 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    console.warn('[accident-report] invalid payload:', parsed.error.issues.slice(0, 5));
    return NextResponse.json({ error: 'invalid', issues: parsed.error.issues.map((i) => i.path.join('.')) }, { status: 400 });
  }
  const p = parsed.data;

  if (!(await verifyTurnstile(p.turnstileToken))) {
    return NextResponse.json({ error: 'turnstile' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Signature → storage
  const signaturePath = `uploads/${p.draftId}/signature.png`;
  const sigBytes = Buffer.from(p.signature.replace(/^data:image\/png;base64,/, ''), 'base64');
  const sigUpload = await supabase.storage.from(BUCKET).upload(signaturePath, sigBytes, {
    contentType: 'image/png',
    upsert: true,
  });
  if (sigUpload.error) {
    console.error('[accident-report] signature upload failed:', sigUpload.error.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }

  // 2. Save the report
  const { signature: _sig, turnstileToken: _t, ...rest } = p;
  void _sig; void _t;
  const stored: StoredReport = { ...rest, signaturePath, submittedAt: new Date().toISOString() };

  const { data: row, error: insertError } = await supabase
    .from('accident_reports')
    .insert({
      car_plate: formatPlate(p.car.plate),
      car_model: p.car.model,
      driver_name: p.driver.name,
      driver_phone: p.driver.phone,
      accident_date: p.accident.date,
      other_vehicle: p.other.involved,
      branch: p.branch ?? null,
      locale: p.locale,
      data: stored,
      link_token: p.linkToken ?? null,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    })
    .select('id')
    .single();

  if (insertError || !row) {
    console.error('[accident-report] insert failed:', insertError?.message);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
  const id = row.id as string;

  if (p.linkToken) {
    await supabase.from('accident_report_links').update({ used_at: new Date().toISOString() }).eq('token', p.linkToken);
  }

  // 3. PDF + email. The report is already saved, so a failure here is logged
  //    and visible in the admin screen, but the customer still gets a success.
  try {
    const sign = async (path?: string) => {
      if (!path) return undefined;
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
      return data?.signedUrl;
    };
    const photos = (await Promise.all(p.photos.map(sign))).filter((u): u is string => !!u);
    const html = generateAccidentReportHTML(id, stored, {
      photos,
      licensePhoto: await sign(p.driver.licensePhoto),
      docsPhoto: await sign(p.other.docsPhoto),
      signature: p.signature,
    });
    const pdf = await renderPdf(html);

    const pdfPath = `reports/${id}.pdf`;
    await supabase.storage.from(BUCKET).upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: true });

    const { data: settings } = await supabase.from('accident_report_settings').select('recipients').eq('id', 1).single();
    const recipients: string[] = settings?.recipients?.length ? settings.recipients : ['office@smartcar.co.il'];
    const sent = await sendReportEmails(id, stored, pdf, recipients);

    await supabase.from('accident_reports').update({ pdf_path: pdfPath, email_sent: sent }).eq('id', id);
  } catch (err) {
    console.error('[accident-report] pdf/email failed for', id, err);
  }

  return NextResponse.json({ id });
}
