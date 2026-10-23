// Read-only public sitemap audit. No credentials, customer APIs, mutations or
// indexing requests. A failing score is a finding, not permission to hide URLs.
import { writeFileSync } from 'node:fs';

const base = new URL(process.argv.find(v => v.startsWith('--base='))?.slice(7) || 'https://www.smartcar.co.il');
const out = process.argv.find(v => v.startsWith('--out='))?.slice(6);
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const strip = s => decode(s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3])]));
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  return { response, html: await response.text() };
}
const { response: sitemapResponse, html: xml } = await get(new URL('/sitemap.xml', base));
if (!sitemapResponse.ok || !xml.includes('<urlset')) throw new Error('Sitemap unavailable or not XML');
const urls = [...new Set([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => decode(m[1])))];
if (!urls.length || urls.length > 2000) throw new Error('Unexpected sitemap size; inspect before crawling');
if (urls.some(u => new URL(u).origin !== base.origin)) throw new Error('Cross-origin sitemap entry; inspect canonical host first');
const rows = [];
let index = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (index < urls.length) {
    const url = urls[index++];
    try {
      const { response, html } = await get(url);
      const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attrs(m[0]));
      const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => attrs(m[0]));
      const meta = name => metas.find(m => m.name === name || m.property === name)?.content;
      const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => strip(m[1]));
      const alternates = links.filter(l => l.rel === 'alternate' && l.hreflang).map(l => ({ language: l.hreflang, href: l.href }));
      rows.push({ url, status: response.status, final: response.url, title: strip(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''), description: meta('description') || '', canonical: links.find(l => l.rel === 'canonical')?.href, robots: [meta('robots'), response.headers.get('x-robots-tag')].filter(Boolean).join('; '), h1, alternates, ogTitle: meta('og:title'), ogDescription: meta('og:description'), jsonLdBlocks: (html.match(/application\/ld\+json/g) || []).length, rentalLinksInInitialHtml: [...html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map(m => decode(m[1])).filter(h => /\/(?:he|en)\/rental\/[^/?]+/.test(h)).length });
    } catch (error) { rows.push({ url, error: error.message }); }
  }
}));
rows.sort((a, b) => a.url.localeCompare(b.url));
const duplicates = field => {
  const groups = new Map();
  for (const r of rows) if (r[field]) groups.set(r[field], [...(groups.get(r[field]) || []), r.url]);
  return [...groups].filter(([, group]) => group.length > 1).map(([value, urls]) => ({ value, urls }));
};
const summary = {
  checked: rows.length,
  requestErrors: rows.filter(r => r.error || r.status !== 200),
  missingTitle: rows.filter(r => !r.error && !r.title).map(r => r.url),
  missingDescription: rows.filter(r => !r.error && !r.description).map(r => r.url),
  h1Issues: rows.filter(r => !r.error && r.h1.length !== 1).map(r => ({ url: r.url, h1: r.h1 })),
  canonicalIssues: rows.filter(r => !r.error && r.canonical !== r.url).map(r => ({ url: r.url, canonical: r.canonical })),
  noindexInSitemap: rows.filter(r => /noindex/i.test(r.robots || '')).map(r => r.url),
  missingLanguagePair: rows.filter(r => !r.error && (!r.alternates.some(l => l.language === 'he') || !r.alternates.some(l => l.language === 'en'))).map(r => r.url),
  duplicateTitles: duplicates('title'),
  duplicateDescriptions: duplicates('description'),
};
const report = { generatedAt: new Date().toISOString(), base: base.origin, summary, rows };
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...summary, duplicateTitles: summary.duplicateTitles.length, duplicateDescriptions: summary.duplicateDescriptions.length, report: out || null }, null, 2));
