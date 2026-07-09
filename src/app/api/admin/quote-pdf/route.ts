import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { generateQuoteHTML, type QuoteData } from '@/lib/quote-pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function checkAuth() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

export async function POST(request: Request) {
  if (!await checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = (await request.json().catch(() => null)) as QuoteData | null;
  if (!data || !data.customerName || !data.vehicles?.length) {
    return NextResponse.json({ error: 'Missing quote data' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const html = generateQuoteHTML(data, origin);

  let browser;
  try {
    const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
      import('puppeteer-core'),
      import('@sparticuz/chromium'),
    ]);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="SmartCar_Quote_${(data.customerName || 'Client').replace(/[\s/\\]/g, '_')}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[quote-pdf] render error:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
