import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BranchPage, { generateMetadata as branchMetadata } from '@/app/[locale]/branches/[id]/page';
import ServicePage, { generateMetadata as serviceMetadata } from '@/app/[locale]/services/[type]/page';
import { metadata as adminMetadata } from '@/app/[locale]/admin/layout';
import { BRANCHES } from '@/lib/branches';
import { BRANCH_RENTAL_ADVICE, SERVICE_RENTAL_ADVICE, rentalCopy } from '@/lib/public-rental-content';

describe('public rental search content and preserved private exclusion', () => {
  for (const locale of ['he', 'en']) {
    it(`uses distinct branch search titles and descriptions in ${locale}`, () => {
      const entries = Object.values(BRANCH_RENTAL_ADVICE);
      expect(new Set(entries.map(a => rentalCopy(a.title, locale))).size).toBe(entries.length);
      expect(new Set(entries.map(a => rentalCopy(a.description, locale))).size).toBe(entries.length);
    });
    for (const branch of BRANCHES) {
      it(`renders ${locale}/${branch.id} advice in HTML with matching metadata`, async () => {
        const props = { params: Promise.resolve({ locale, id: branch.id }) };
        const metadata = await branchMetadata(props);
        const html = renderToStaticMarkup(await BranchPage(props));
        const advice = BRANCH_RENTAL_ADVICE[branch.id];
        expect(metadata.title).toEqual({ absolute: rentalCopy(advice.title, locale) });
        expect(metadata.description).toBe(rentalCopy(advice.description, locale));
        expect(metadata.openGraph?.title).toBe(rentalCopy(advice.title, locale));
        expect(metadata.twitter?.description).toBe(metadata.description);
        expect(metadata.alternates?.canonical).toBe(`/${locale}/branches/${branch.id}`);
        expect(metadata.alternates?.languages).toMatchObject({ he: `/he/branches/${branch.id}`, en: `/en/branches/${branch.id}` });
        expect(html.match(/<h1\b/g)).toHaveLength(1);
        expect(html).toContain(locale === 'he' ? branch.streetHe : branch.streetEn);
        for (const section of advice.sections) expect(html).toContain(rentalCopy(section.heading, locale).replace(/&/g, '&amp;'));
        for (const path of ['rental', 'services/monthly', 'leasing', 'terms']) expect(html).toContain(`href="/${locale}/${path}"`);
        expect(html).not.toContain(`href="/${locale}/admin`);
        expect(html).toContain('min-h-12');
      });
    }
    for (const type of ['daily', 'monthly', 'hourly', 'leasing', 'business', 'commercial', 'new-driver', 'sale']) {
      it(`renders useful ${locale}/${type} content without hiding the route`, async () => {
        const props = { params: Promise.resolve({ locale, type }) };
        const metadata = await serviceMetadata(props);
        const html = renderToStaticMarkup(await ServicePage(props));
        expect(metadata.title).toEqual({ absolute: rentalCopy(SERVICE_RENTAL_ADVICE[type].title, locale) });
        expect(metadata.description).toBe(rentalCopy(SERVICE_RENTAL_ADVICE[type].description, locale));
        expect(metadata.alternates?.canonical).toBe(`/${locale}/services/${type}`);
        expect(metadata.robots).toBeUndefined();
        expect(html.match(/<h1\b/g)).toHaveLength(1);
        for (const section of SERVICE_RENTAL_ADVICE[type].sections) expect(html).toContain(rentalCopy(section.heading, locale));
        expect(html).toContain('application/ld+json');
        expect(html).toContain(`href="/${locale}/leasing"`);
      });
    }
  }
  it('keeps the entire admin area noindex/nofollow', () => {
    expect(adminMetadata.robots).toEqual({ index: false, follow: false });
  });
  it('rejects unknown branch/service metadata instead of inventing a landing page', async () => {
    expect(await branchMetadata({ params: Promise.resolve({ locale: 'he', id: 'made-up' }) })).toEqual({});
    expect(await serviceMetadata({ params: Promise.resolve({ locale: 'en', type: 'made-up' }) })).toEqual({});
  });
});
