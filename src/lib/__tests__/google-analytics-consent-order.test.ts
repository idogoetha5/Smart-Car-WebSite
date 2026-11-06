import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

// Execute the actual inline initialization, including the race where React's
// consent update reached the queue before Next's inline Script ran.
const source = readFileSync(new URL('../../components/analytics/GoogleAnalytics.tsx', import.meta.url), 'utf8');
const script = source.match(/\{`([\s\S]+?)`\}/)![1]
  .replace('${CONSENT_KEY}', 'cookie_consent').replace('${GA_ID}', 'G-TEST');

describe('GA consent at the initial page view', () => {
  it('queues early consent and subsequent initialization as the documented Arguments objects', () => {
    const bridge = source.match(/function getGtag\(\) \{[\s\S]*?\n\}/)![0]
      .replace('dataLayer!', 'dataLayer').replace('...args: unknown[]', '...args');
    const browser = { dataLayer: [] as unknown[][], localStorage: { getItem: () => 'accepted' } };
    runInNewContext(`${bridge}\ngetGtag()('consent','update',{analytics_storage:'granted'});\n${script}`, { window: browser });
    expect(browser.dataLayer.length).toBeGreaterThanOrEqual(5);
    for (const entry of browser.dataLayer) expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]');
    expect(Array.from(browser.dataLayer.at(-1)!)).toEqual(['config', 'G-TEST', { send_page_view: true, anonymize_ip: true }]);
  });
  it.each(['accepted', 'rejected', null, 'storage-unavailable'])('honours the current stored decision after an earlier queued grant: %s', decision => {
    const browser = {
      dataLayer: [['consent', 'update', { analytics_storage: 'granted' }]] as unknown[][],
      localStorage: { getItem: () => { if (decision === 'storage-unavailable') throw new Error('blocked'); return decision; } },
    };
    runInNewContext(script, { window: browser });
    let effective = 'denied';
    let atPageView: string | undefined;
    for (const item of browser.dataLayer) {
      const [command, mode, fields] = Array.from(item);
      if (command === 'consent' && (mode === 'default' || mode === 'update')) effective = (fields as { analytics_storage: string }).analytics_storage;
      if (command === 'config') atPageView = effective;
    }
    expect(atPageView).toBe(decision === 'accepted' ? 'granted' : 'denied');
    const config = Array.from(browser.dataLayer.at(-1)!);
    expect(config[0]).toBe('config');
    expect(config[1]).toBe('G-TEST');
    expect(config[2]).toMatchObject({ send_page_view: true });
  });
});
