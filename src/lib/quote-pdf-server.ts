import { generateQuoteHTML, type QuoteData } from '@/lib/quote-pdf';

/**
 * Render the same quote HTML used by the admin preview into a complete PDF.
 * Kept in one server-only helper so downloading and emailing can never drift
 * into two different quote documents.
 */
export async function renderQuotePdf(data: QuoteData): Promise<Buffer> {
  const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
    import('puppeteer-core'),
    import('@sparticuz/chromium'),
  ]);

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(generateQuoteHTML(data), { waitUntil: 'load' });

    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              })
        )
      );
      if (document.fonts?.ready) await document.fonts.ready;
    });

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
