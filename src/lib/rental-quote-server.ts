import { generateRentalQuoteHTML, type RentalQuoteData } from '@/lib/rental-quote';

export async function renderRentalQuotePdf(data: RentalQuoteData): Promise<Buffer> {
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
    await page.setContent(generateRentalQuoteHTML(data), { waitUntil: 'load' });
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.onload = resolve;
                image.onerror = resolve;
              })
        )
      );
      if (document.fonts?.ready) await document.fonts.ready;
    });

    return Buffer.from(
      await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      })
    );
  } finally {
    await browser.close().catch(() => {});
  }
}
