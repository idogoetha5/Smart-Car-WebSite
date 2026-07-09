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

  const html = generateQuoteHTML(data);

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
    // Match the template's own design canvas (794px = A4 at 96dpi) so the
    // A4-sized .doc lays out at exactly one page before capture.
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    // Ensure the vehicle image and embedded fonts are fully ready — a
    // half-loaded car photo or fallback font would render a broken PDF.
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; })
        )
      );
      if (document.fonts?.ready) await document.fonts.ready;
    });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });

    // Content-Disposition header values must be ASCII (ByteString) — a
    // Hebrew customer name would otherwise throw at the header-set call.
    // Use a plain ASCII fallback name plus the RFC 5987 filename* form so
    // browsers still show the real (Unicode) name when they support it.
    const asciiName = (data.customerName || 'Client').replace(/[^\x20-\x7E]/g, '').trim().replace(/[\s/\\]/g, '_') || 'Client';
    const utf8Name = encodeURIComponent(`SmartCar_Quote_${data.customerName || 'Client'}.pdf`);

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="SmartCar_Quote_${asciiName}.pdf"; filename*=UTF-8''${utf8Name}`,
      },
    });
  } catch (err) {
    console.error('[quote-pdf] render error:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
