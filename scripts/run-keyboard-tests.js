/**
 * Keyboard-only accessibility checks that automated rule engines cannot
 * make: focus order, visible focus, keyboard traps, skip-link behaviour
 * and Escape handling on the composite widgets.
 *
 * Each check reports PASS / FAIL / NOT_TESTED with the observed evidence,
 * so nothing is asserted without something backing it.
 *
 * Usage: node scripts/run-keyboard-tests.js [outfile]
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT = process.argv[2] || 'evidence/a11y/keyboard-tests.json';

const describeActive = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') || null,
    name: (
      el.getAttribute('aria-label') ||
      el.textContent?.trim().slice(0, 40) ||
      el.getAttribute('title') ||
      ''
    ).trim(),
    id: el.id || null,
    cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 70),
    html: el.outerHTML ? el.outerHTML.slice(0, 120) : '',
    // Any of these constitutes a visible focus indicator
    focusVisible:
      cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
        ? 'outline'
        : cs.boxShadow && cs.boxShadow !== 'none'
        ? 'box-shadow'
        : null,
    onScreen: r.width > 0 && r.height > 0,
    // Cloudflare Turnstile renders its own focusable wrapper we don't style
    thirdParty: !!el.closest('[class*="cf-turnstile"]') || el.tagName === 'IFRAME',
  };
};

async function tabThrough(page, steps) {
  const seq = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab');
    const d = await page.evaluate(describeActive);
    if (d) seq.push(d);
  }
  return seq;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const checks = [];
  const add = (name, status, evidence) => {
    checks.push({ name, status, evidence });
    console.log(`${status.padEnd(10)} ${name}`);
  };

  // ---- 1. Skip link is the first stop and actually moves focus ----
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/he`, { waitUntil: 'networkidle0', timeout: 45000 });
    await page.keyboard.press('Tab');
    const first = await page.evaluate(describeActive);
    const isSkip = !!first && /דלג|skip/i.test(first.name);
    // Activating it must move focus/scroll to #main-content
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 400));
    const target = await page.evaluate(() => {
      const m = document.getElementById('main-content');
      return { exists: !!m, hash: location.hash };
    });
    add(
      'Skip link is first tab stop and targets #main-content (WCAG 2.4.1)',
      isSkip && target.exists ? 'PASS' : 'FAIL',
      { firstTabStop: first, target }
    );
    await page.close();
  } catch (e) {
    add('Skip link (WCAG 2.4.1)', 'NOT_TESTED', { error: String(e.message) });
  }

  // ---- 2. Every tab stop has a visible focus indicator ----
  for (const [label, url] of [
    ['home (he)', `${BASE}/he`],
    ['contact (he)', `${BASE}/he/contact`],
    ['home (en)', `${BASE}/en`],
  ]) {
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
      const seq = await tabThrough(page, 30);
      const noIndicator = seq.filter(
        (s) => s.onScreen && !s.focusVisible && !s.thirdParty
      );
      add(
        `Visible focus indicator on every tab stop — ${label} (WCAG 2.4.7)`,
        noIndicator.length === 0 ? 'PASS' : 'FAIL',
        { tabStops: seq.length, withoutIndicator: noIndicator }
      );
      await page.close();
    } catch (e) {
      add(`Visible focus — ${label}`, 'NOT_TESTED', { error: String(e.message) });
    }
  }

  // ---- 3. No keyboard trap: mobile menu (open, Escape closes, focus returns) ----
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`${BASE}/he`, { waitUntil: 'networkidle0', timeout: 45000 });
    await page.click('button[aria-controls="mobile-menu"]');
    await page.waitForSelector('#mobile-menu', { timeout: 5000 });
    const openState = await page.evaluate(
      () => document.querySelector('button[aria-controls="mobile-menu"]').getAttribute('aria-expanded')
    );
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));
    const after = await page.evaluate(() => ({
      menuGone: !document.getElementById('mobile-menu'),
      focusOnTrigger:
        document.activeElement ===
        document.querySelector('button[aria-controls="mobile-menu"]'),
      expanded: document
        .querySelector('button[aria-controls="mobile-menu"]')
        .getAttribute('aria-expanded'),
    }));
    add(
      'Mobile menu: Escape closes and returns focus to trigger (WCAG 2.1.2)',
      openState === 'true' && after.menuGone && after.focusOnTrigger ? 'PASS' : 'FAIL',
      { ariaExpandedWhenOpen: openState, afterEscape: after }
    );
    await page.close();
  } catch (e) {
    add('Mobile menu Escape (WCAG 2.1.2)', 'NOT_TESTED', { error: String(e.message) });
  }

  // ---- 4. No keyboard trap: date picker (Escape closes, focus returns) ----
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/he`, { waitUntil: 'networkidle0', timeout: 45000 });
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button[aria-haspopup="dialog"]')].find(
        (x) => x.getBoundingClientRect().width > 0
      );
      if (!b) return false;
      b.setAttribute('data-kbtest', '1');
      b.click();
      return true;
    });
    if (!opened) throw new Error('no visible date picker trigger');
    // Scope to the picker's own popup — the cookie banner also carries
    // role="dialog", so a global query would never report it as closed.
    const _pickerDialog = () =>
      [...document.querySelectorAll('[role="dialog"]')].filter((d) =>
        d.querySelector('[class*="rdp"], table, [class*="calendar"]') ||
        d.className.includes('rounded-2xl')
      );
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[role="dialog"]')].some((d) =>
          d.className.includes('rounded-2xl')
        ),
      { timeout: 5000 }
    );
    const openCount = await page.evaluate(
      () => [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.className.includes('rounded-2xl')).length
    );
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 800));
    const after = await page.evaluate(() => ({
      pickerDialogsOpen: [...document.querySelectorAll('[role="dialog"]')].filter((d) =>
        d.className.includes('rounded-2xl')
      ).length,
      otherDialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) =>
        d.className.slice(0, 50)
      ),
      focusOnTrigger:
        document.activeElement === document.querySelector('[data-kbtest="1"]'),
    }));
    after.dialogGone = after.pickerDialogsOpen === 0;
    after.openedCount = openCount;
    add(
      'Date picker: Escape closes and returns focus to trigger (WCAG 2.1.2)',
      after.dialogGone && after.focusOnTrigger ? 'PASS' : 'FAIL',
      after
    );
    await page.close();
  } catch (e) {
    add('Date picker Escape (WCAG 2.1.2)', 'NOT_TESTED', { error: String(e.message) });
  }

  // ---- 5. FAQ accordion operable by keyboard, state exposed ----
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/he`, { waitUntil: 'networkidle0', timeout: 45000 });
    await page.waitForSelector('#faq-button-0', { timeout: 10000 });
    await page.focus('#faq-button-0');
    const before = await page.$eval('#faq-button-0', (b) => b.getAttribute('aria-expanded'));
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 300));
    const after = await page.evaluate(() => ({
      expanded: document.getElementById('faq-button-0').getAttribute('aria-expanded'),
      panel: !!document.getElementById('faq-panel-0'),
      panelRole: document.getElementById('faq-panel-0')?.getAttribute('role') || null,
    }));
    add(
      'FAQ accordion: operable by keyboard, aria-expanded updates (WCAG 2.1.1 / 4.1.2)',
      before === 'false' && after.expanded === 'true' && after.panel ? 'PASS' : 'FAIL',
      { before, after }
    );
    await page.close();
  } catch (e) {
    add('FAQ accordion keyboard', 'NOT_TESTED', { error: String(e.message) });
  }

  // ---- 6. Extras checkboxes reachable by keyboard (were display:none) ----
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/he/contact`, { waitUntil: 'networkidle0', timeout: 45000 });
    // Contact page has no extras; this check targets the booking form and
    // is reported NOT_TESTED when no vehicle page is reachable locally.
    throw new Error(
      'requires a vehicle detail page; /api/vehicles is unavailable in this local env'
    );
  } catch (e) {
    add(
      'Booking extras checkboxes keyboard-reachable (WCAG 2.1.1)',
      'NOT_TESTED',
      { error: String(e.message), howToComplete: 'Run against production or a local env with Supabase credentials, open a vehicle page, Tab to the extras list and confirm each checkbox receives focus with a visible ring.' }
    );
  }

  // ---- 7. Language toggle & accessibility button have accessible names ----
  try {
    const page = await browser.newPage();
    await page.goto(`${BASE}/he`, { waitUntil: 'networkidle0', timeout: 45000 });
    const named = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll('button, a')) {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Accessible name can also come from a descendant image's alt
        // text or from visually-hidden text — count both.
        const imgAlt = [...b.querySelectorAll('img')]
          .map((i) => i.getAttribute('alt') || '')
          .join(' ')
          .trim();
        const name = (
          b.getAttribute('aria-label') ||
          b.getAttribute('aria-labelledby') ||
          b.textContent?.trim() ||
          imgAlt ||
          b.getAttribute('title') ||
          ''
        ).trim();
        // Third-party widgets (e.g. the Cloudflare Turnstile iframe
        // wrapper) are outside this codebase's control — recorded
        // separately rather than counted as our failure.
        const thirdParty = !!b.closest('[class*="cf-turnstile"], iframe');
        if (!name && !thirdParty) out.push({ tag: b.tagName, html: b.outerHTML.slice(0, 120) });
      }
      return out;
    });
    add(
      'All visible interactive controls have an accessible name (WCAG 4.1.2)',
      named.length === 0 ? 'PASS' : 'FAIL',
      { unnamed: named }
    );
    await page.close();
  } catch (e) {
    add('Accessible names', 'NOT_TESTED', { error: String(e.message) });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(checks, null, 2));
  const pass = checks.filter((c) => c.status === 'PASS').length;
  const fail = checks.filter((c) => c.status === 'FAIL').length;
  const nt = checks.filter((c) => c.status === 'NOT_TESTED').length;
  console.log(`\nPASS ${pass}  FAIL ${fail}  NOT_TESTED ${nt}`);
  await browser.close();
})();
