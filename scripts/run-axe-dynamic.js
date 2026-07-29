/**
 * Accessibility scan of DYNAMIC states — the ones a page-load scan never
 * reaches: open menus, expanded accordions, open date pickers, forms in
 * their error state, cookie banner, etc.
 *
 * Also runs a reflow/zoom pass (320px, 200%, 400%) and a
 * prefers-reduced-motion pass.
 *
 * Usage: node scripts/run-axe-dynamic.js [outfile]
 */
const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = process.argv[2] || 'evidence/a11y/axe-dynamic-after.json';

const analyze = (page) =>
  new AxePuppeteer(page).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();

const slim = (r) =>
  r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      html: String(n.html).slice(0, 200),
      failureSummary: n.failureSummary,
    })),
  }));

/** Each scenario: navigate, drive the UI into a state, then scan. */
const scenarios = [
  {
    name: 'mobile-menu-open (he)',
    url: `${BASE}/he`,
    viewport: { width: 390, height: 844, isMobile: true },
    async setup(page) {
      await page.click('button[aria-controls="mobile-menu"]');
      await page.waitForSelector('#mobile-menu', { timeout: 5000 });
    },
  },
  {
    name: 'mobile-menu-open (en)',
    url: `${BASE}/en`,
    viewport: { width: 390, height: 844, isMobile: true },
    async setup(page) {
      await page.click('button[aria-controls="mobile-menu"]');
      await page.waitForSelector('#mobile-menu', { timeout: 5000 });
    },
  },
  {
    name: 'faq-accordion-expanded (he)',
    url: `${BASE}/he`,
    async setup(page) {
      await page.waitForSelector('#faq-button-0', { timeout: 10000 });
      await page.click('#faq-button-0');
      await page.waitForSelector('#faq-panel-0', { timeout: 5000 });
    },
  },
  {
    name: 'faq-accordion-expanded (en)',
    url: `${BASE}/en`,
    async setup(page) {
      await page.waitForSelector('#faq-button-0', { timeout: 10000 });
      await page.click('#faq-button-0');
      await page.waitForSelector('#faq-panel-0', { timeout: 5000 });
    },
  },
  {
    name: 'hero-datepicker-open (he)',
    url: `${BASE}/he`,
    async setup(page) {
      // There are mobile and desktop copies; only one is visible.
      const clicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button[aria-haspopup="dialog"]')];
        const visible = btns.find((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (!visible) return false;
        visible.click();
        return true;
      });
      if (!clicked) throw new Error('no visible datepicker trigger');
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    },
  },
  {
    name: 'cookie-banner-visible (he)',
    url: `${BASE}/he`,
    async setup(page) {
      // Banner shows only without a prior consent cookie; fresh context has none.
      await new Promise((r) => setTimeout(r, 1500));
    },
  },
  {
    name: 'review-form-open (he)',
    url: `${BASE}/he`,
    async setup(page) {
      const clicked = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) =>
          x.textContent.includes('כתוב ביקורת')
        );
        if (b) { b.click(); return true; }
        return false;
      });
      if (!clicked) throw new Error('review CTA not found');
      await new Promise((r) => setTimeout(r, 1200));
    },
  },
  {
    name: 'leasing-inquiry-form-open (he)',
    url: `${BASE}/he/leasing`,
    async setup(page) {
      await new Promise((r) => setTimeout(r, 1500));
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) =>
          /פנייה|שלח|בקש/.test(x.textContent)
        );
        if (b) b.click();
      });
      await new Promise((r) => setTimeout(r, 1200));
    },
  },
  {
    name: 'booking-form-validation-errors (he)',
    url: null, // resolved at runtime to the first vehicle
    async setup(page) {
      await new Promise((r) => setTimeout(r, 1500));
      // Submit empty to force the error state
      await page.evaluate(() => {
        const f = document.querySelector('form');
        if (f) f.requestSubmit();
      });
      await new Promise((r) => setTimeout(r, 1500));
    },
  },
  {
    name: 'contact-form (he)',
    url: `${BASE}/he/contact`,
    async setup(page) {
      await new Promise((r) => setTimeout(r, 1200));
    },
  },
  {
    name: 'condition-report-form (he)',
    url: `${BASE}/he/condition-report`,
    async setup(page) {
      await new Promise((r) => setTimeout(r, 1200));
    },
  },
  // ---- Reflow / zoom / motion passes (WCAG 1.4.10, 1.4.4, 2.3.3) ----
  {
    name: 'reflow-320px (he home)',
    url: `${BASE}/he`,
    viewport: { width: 320, height: 800, isMobile: true },
    checkOverflow: true,
  },
  {
    name: 'reflow-320px (he rental)',
    url: `${BASE}/he/rental`,
    viewport: { width: 320, height: 800, isMobile: true },
    checkOverflow: true,
  },
  {
    name: 'zoom-200pct (he home)',
    url: `${BASE}/he`,
    // 200% zoom at a 1280px desktop ≈ a 640px CSS viewport
    viewport: { width: 640, height: 512 },
    checkOverflow: true,
  },
  {
    name: 'zoom-400pct (he home)',
    url: `${BASE}/he`,
    // 400% zoom at 1280px ≈ a 320px CSS viewport
    viewport: { width: 320, height: 256 },
    checkOverflow: true,
  },
  {
    name: 'reduced-motion (he home)',
    url: `${BASE}/he`,
    reducedMotion: true,
  },
];

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const results = [];

  // Resolve a real vehicle URL for the booking-form scenario
  let vehicleUrl = null;
  try {
    const p = await browser.newPage();
    await p.goto(`${BASE}/he/rental`, { waitUntil: 'networkidle0', timeout: 45000 });
    // Vehicle cards render client-side after the API call resolves.
    try {
      await p.waitForFunction(
        () => [...document.querySelectorAll('a')].some((x) =>
          /\/(he|en)\/rental\/.+/.test(x.getAttribute('href') || '')),
        { timeout: 20000 }
      );
    } catch { /* fall through — reported as NOT TESTED */ }
    vehicleUrl = await p.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find((x) =>
        /\/(he|en)\/rental\/.+/.test(x.getAttribute('href') || ''));
      return a ? a.href : null;
    });
    await p.close();
  } catch { /* leave null; scenario will report NOT TESTED */ }

  for (const sc of scenarios) {
    const page = await browser.newPage();
    const entry = { scenario: sc.name, url: sc.url || vehicleUrl };
    try {
      if (sc.viewport) await page.setViewport({ deviceScaleFactor: 1, ...sc.viewport });
      if (sc.reducedMotion) {
        await page.emulateMediaFeatures([
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ]);
      }
      const target = sc.url || vehicleUrl;
      if (!target) throw new Error('no target URL resolved');
      await page.goto(target, { waitUntil: 'networkidle0', timeout: 45000 });
      if (sc.setup) await sc.setup(page);

      if (sc.checkOverflow) {
        entry.horizontalOverflow = await page.evaluate(() => {
          const d = document.documentElement;
          return {
            scrollWidth: d.scrollWidth,
            clientWidth: d.clientWidth,
            overflows: d.scrollWidth > d.clientWidth + 1,
          };
        });
      }

      const r = await analyze(page);
      entry.violations = slim(r);
      entry.status = 'SCANNED';
    } catch (e) {
      entry.status = 'NOT_TESTED';
      entry.error = String(e.message || e);
      entry.violations = [];
    }
    results.push(entry);
    const n = entry.violations.length;
    const of = entry.horizontalOverflow?.overflows ? ' HORIZONTAL-OVERFLOW' : '';
    console.log(
      `${entry.status === 'SCANNED' ? (n ? 'FAIL' : 'PASS') : 'NOT_TESTED'}  ${sc.name}  violations=${n}${of}` +
        (entry.error ? `  (${entry.error})` : '')
    );
    await page.close();
  }

  fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  const total = results.reduce((s, r) => s + r.violations.length, 0);
  const notTested = results.filter((r) => r.status === 'NOT_TESTED').length;
  console.log(
    `\nscenarios: ${results.length}  total violations: ${total}  not-tested: ${notTested}`
  );
  await browser.close();
})();
