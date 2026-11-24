import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resend } from 'resend';
import sharp from 'sharp';
import { maskCard } from '@/lib/customer-verification/card';
import { OFFICE_EMAIL } from '@/lib/constants';
import { heebo400, heebo700, logo_png } from '@/lib/quote-assets';
import { type DeclarationSubmission } from '@/lib/rental-declaration';
import { createAdminClient } from '@/lib/supabase/server';

type RecordForEmail = { id: string; pdf_base64: string; office_email_sent_at: string | null };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] ?? char));

export async function normalizeDeclarationSignature(signature: DeclarationSubmission['signature']) {
  if (signature.type === 'typed') return signature;
  const source = Buffer.from(signature.png.split(',')[1], 'base64');
  const image = sharp(source, { limitInputPixels: 200_000 });
  const metadata = await image.metadata();
  if (metadata.format !== 'png' || metadata.width !== 720 || metadata.height !== 220) {
    throw new Error('Invalid signature dimensions');
  }
  const raw = await image.ensureAlpha().raw().toBuffer();
  let ink = 0;
  for (let pixel = 3; pixel < raw.length; pixel += 4) {
    if (raw[pixel] > 80 && ++ink >= 10) break;
  }
  if (ink < 10) throw new Error('Empty signature');
  const png = await sharp(raw, { raw: { width: 720, height: 220, channels: 4 } }).png().toBuffer();
  return { type: 'drawn' as const, png: 'data:image/png;base64,' + png.toString('base64') };
}

export async function declarationDocumentHtml(value: DeclarationSubmission): Promise<string> {
  const en = value.locale === 'en';
  const template = await readFile(join(process.cwd(), 'public', 'forms', en ? 'declaration-en.html' : 'declaration.html'), 'utf8');
  const terms = template.match(/<article class="terms">([\s\S]*?)<\/article>/)?.[1];
  if (!terms) throw new Error('Missing declaration text');
  const signature = value.signature.type === 'drawn'
    ? '<img class="signature" alt="" src="' + value.signature.png + '">'
    : '<bdi>' + escapeHtml(value.signature.name) + '</bdi>';
  const populatedTerms = terms.replace(/<span data-(?:en|he)="[^"]*">([^<]*)<\/span>/g, (_match, copy: string) =>
    copy.replace(/\{(\w+)\}/g, (_placeholder, key: string) => {
      if (key === 'signature') return signature;
      if (!Object.prototype.hasOwnProperty.call(value.fields, key)) return '_____';
      const raw = value.fields[key as keyof typeof value.fields];
      const field = key === 'cardNumber' ? maskCard(raw.replace(/\D/g, '').slice(-4)) : raw;
      return '<bdi>' + (field ? escapeHtml(field) : '_____') + '</bdi>';
    })
  );
  return `<!doctype html><html lang="${value.locale}" dir="${en ? 'ltr' : 'rtl'}"><meta charset="utf-8">
    <style>
    @font-face{font-family:Heebo;src:url(data:font/ttf;base64,${heebo400})} @font-face{font-family:Heebo;src:url(data:font/ttf;base64,${heebo700});font-weight:bold}
    @page{size:A4;margin:13mm}body{font:11pt/1.44 Heebo,Arial,sans-serif;color:#17383a}
    header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #24575a;padding-bottom:9px}
    h1{margin:0;font-size:20pt}h3{display:none}
    li{margin-block:5px}li p{margin-block:4px} bdi{overflow-wrap:anywhere}.signature{width:150px;height:auto;vertical-align:middle}.last-signer{margin-top:18px} bdi{font-weight:bold}
    </style>
    <header><h1>${en ? 'Declaration and undertaking' : 'הצהרה והתחיבות'}</h1><img width="94" alt="SmartCar" src="data:image/png;base64,${logo_png}"></header>
    <article>${populatedTerms}</article></html>`;
}

export async function renderDeclarationPdf(value: DeclarationSubmission): Promise<Buffer> {
  const html = await declarationDocumentHtml(value);
  const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
    import('puppeteer-core'), import('@sparticuz/chromium'),
  ]);
  const browser = await puppeteer.launch({
    args: chromium.args, executablePath: await chromium.executablePath(), headless: true, timeout: 20_000,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 15_000 });
    return Buffer.from(await page.pdf({ printBackground: true, preferCSSPageSize: true, timeout: 15_000 }));
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function emailDeclaration(row: RecordForEmail): Promise<boolean> {
  if (row.office_email_sent_at) return true;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: `SmartCar <${OFFICE_EMAIL}>`,
      to: OFFICE_EMAIL,
      subject: 'SmartCar | התקבלה הצהרה והתחייבות חתומה',
      text: 'מצורף טופס ההצהרה החתום עם מספר כרטיס מוסתר. לפתיחת העותק בכניסה לממשק הניהול: https://www.smartcar.co.il/api/admin/declarations/' + row.id,
      attachments: [{ content: Buffer.from(row.pdf_base64, 'base64'), filename: 'SmartCar-declaration-' + row.id + '.pdf', contentType: 'application/pdf' }],
    }, { idempotencyKey: 'signed-declaration-' + row.id });
    if (error || !data?.id) return false;
    const saved = await createAdminClient().from('rental_declarations')
      .update({ office_email_sent_at: new Date().toISOString(), office_email_id: data.id })
      .eq('id', row.id).is('office_email_sent_at', null);
    return !saved.error;
  } catch {
    return false;
  }
}
