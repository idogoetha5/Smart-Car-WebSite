const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs');

const urls = fs.readFileSync('scripts/a11y-urls.txt', 'utf8').split('\n').filter(Boolean);

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const results = [];
  for (const url of urls) {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const axeResults = await new AxePuppeteer(page).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      results.push({
        url,
        violations: axeResults.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          nodes: v.nodes.map(n => ({ target: n.target, html: n.html.slice(0, 200), failureSummary: n.failureSummary })),
        })),
      });
    } catch (e) {
      results.push({ url, error: String(e) });
    }
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(process.argv[2] || 'axe-results.json', JSON.stringify(results, null, 2));
  const total = results.reduce((s, r) => s + (r.violations ? r.violations.length : 0), 0);
  console.log('pages:', results.length, 'total violation groups:', total);
})();
