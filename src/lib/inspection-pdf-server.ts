import { generateInspectionPdfHTML, type InspectionPdfData } from './inspection-pdf';

/**
 * Renders the signed inspection PDF, same puppeteer-core + @sparticuz/chromium
 * approach as renderQuotePdf (src/lib/quote-pdf-server.ts) — kept in its own
 * server-only helper so the PDF can never drift from the HTML it was built
 * from.
 */
export async function renderInspectionPdf(data: InspectionPdfData): Promise<Buffer> {
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
    await page.setContent(generateInspectionPdfHTML(data), { waitUntil: 'load' });

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

    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
