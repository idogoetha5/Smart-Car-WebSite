import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DeliveryPage, { generateMetadata, generateStaticParams } from '@/app/[locale]/delivery/[city]/page';
import { DELIVERY_CITIES, deliverySearchCopy, isDeliveryRegion } from '@/lib/delivery-cities';
import { BRANCHES } from '@/lib/branches';

describe('delivery search pages describe service areas without inventing branches', () => {
  it('preserves all thirteen existing destinations', () => {
    expect(generateStaticParams()).toEqual(DELIVERY_CITIES.map(c => ({ city: c.slug })));
    expect(DELIVERY_CITIES).toHaveLength(13);
  });
  for (const locale of ['he', 'en']) {
    it(`keeps ${locale} location titles and descriptions distinct and restrained`, () => {
      const copies = DELIVERY_CITIES.map(c => deliverySearchCopy(c, locale));
      expect(new Set(copies.map(c => c.title)).size).toBe(13);
      expect(new Set(copies.map(c => c.description)).size).toBe(13);
      for (const c of copies) expect(c.title).not.toMatch(/!|best|מושלם|הכי זול/i);
    });
    for (const city of DELIVERY_CITIES) {
      it(`renders honest ${locale}/${city.slug} copy, schema and preserved actions`, async () => {
        const params = Promise.resolve({ locale, city: city.slug });
        const metadata = await generateMetadata({ params });
        const copy = deliverySearchCopy(city, locale);
        const html = renderToStaticMarkup(await DeliveryPage({ params }));
        expect(metadata.title).toEqual({ absolute: copy.title });
        expect(metadata.description).toBe(copy.description);
        expect(metadata.openGraph?.title).toBe(copy.title);
        expect(metadata.twitter?.description).toBe(copy.description);
        expect(metadata.alternates?.canonical).toBe(`/${locale}/delivery/${city.slug}`);
        expect(html.match(/<h1\b/g)).toHaveLength(1);
        expect(html).not.toMatch(/הסניף הקרוב ביותר|Nearest branch/);
        expect(html).toContain(locale === 'he' ? 'האומדן באתר אינו מחיר סופי' : 'estimate is not a final price');
        expect(html).toContain(locale === 'he' ? (isDeliveryRegion(city) ? 'ציינו גם את היישוב' : 'אין לנו סניף') : (isDeliveryRegion(city) ? 'Include the town' : 'We do not have a branch'));
        const branch = BRANCHES.find(b => b.id === city.nearestBranch)!;
        for (const path of ['rental', 'services/daily', 'services/monthly', 'branches', `branches/${branch.id}`]) expect(html).toContain(`href="/${locale}/${path}"`);
        expect(html).toContain(`href="tel:${branch.phone}"`);
        expect(html).toContain('https://wa.me/');
        expect(html).toContain('waze.com/');
        const schema = JSON.parse([...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)][0][1]);
        expect(schema.areaServed['@type']).toBe(isDeliveryRegion(city) ? 'Place' : 'City');
        expect(schema.address.streetAddress).toBe(locale === 'he' ? branch.streetHe : branch.streetEn);
        expect(html).toContain('min-h-12');
      });
    }
  }
  it('does not invent unknown delivery destinations', async () => {
    expect(await generateMetadata({ params: Promise.resolve({ locale: 'he', city: 'unknown-place' }) })).toEqual({});
  });
});
