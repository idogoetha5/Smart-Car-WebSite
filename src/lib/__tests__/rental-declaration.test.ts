import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { declarationSubmission } from '@/lib/rental-declaration';
import { declarationDocumentHtml } from '@/lib/rental-declaration-server';

const fixture = {
  id: '9b5b1c34-1f8a-45e6-8373-76409c74f0e0',
  locale: 'he',
  confirmed: true,
  token: 'fictional',
  fields: {
    name: 'שם דוגמה <script>', idNumber: '000000000', street: 'רחוב דוגמה', city: 'עיר דוגמה',
    start: '2030-01-05', end: '2030-01-09', signedDate: '2030-01-05',
    cardHolder: 'בעל כרטיס דוגמה', cardNumber: '4111 1111 1111 1111', cardExpiry: '12/35',
    renter: 'שוכר לדוגמה',
  },
  signature: { type: 'typed', name: 'שם דוגמה <script>' },
};

describe('signed rental declaration', () => {
  it('includes the original clauses, fills repeated identity fields and masks the PAN', async () => {
    const html = await declarationDocumentHtml(declarationSubmission.parse(fixture));
    expect(html).toContain('כרטיס האשראי שפרטיו נקבו לעיל');
    expect(html).toContain('שם החותם+ת.ז');
    expect(html).toContain('•••• 1111');
    expect(html).not.toContain('4111111111111111');
    expect(html).not.toContain('<script>');
    expect(html.match(/שם דוגמה &lt;script&gt;/g)).toHaveLength(4);
    expect(html).not.toMatch(/\{(?:name|cardNumber|signature)\}/);
  });

  it('builds the English document from its translated template', async () => {
    const html = await declarationDocumentHtml(declarationSubmission.parse({ ...fixture, locale: 'en' }));
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('credit card whose details are given above');
    expect(html).toContain('limited guarantor');
  });

  it('rejects a different signing name, an invalid card and reversed dates', () => {
    expect(declarationSubmission.safeParse({ ...fixture, signature: { type: 'typed', name: 'Other' } }).success).toBe(false);
    expect(declarationSubmission.safeParse({ ...fixture, fields: { ...fixture.fields, cardNumber: '4111111111111112' } }).success).toBe(false);
    expect(declarationSubmission.safeParse({ ...fixture, fields: { ...fixture.fields, end: '2029-12-31' } }).success).toBe(false);
  });

  it('accepts an unspecified rental end date and independently optional company details', async () => {
    const submission = declarationSubmission.parse({
      ...fixture,
      fields: {
        ...fixture.fields,
        end: '',
        companyName: 'חברת דוגמה בע״מ',
        companyNumber: '',
        companyAddress: 'רחוב חברה 1',
        companyPhone: '',
      },
    });
    const html = await declarationDocumentHtml(submission);
    expect(html).toContain('חברת דוגמה בע״מ');
    expect(html).toContain('רחוב חברה 1');
    expect(html).not.toContain('ומסתיימת ביום <bdi>_____</bdi>');
    expect(html).not.toContain('to <bdi>_____</bdi>');
    expect(html).not.toContain('Company name is required');
    expect(declarationSubmission.safeParse({
      ...fixture,
      fields: { ...fixture.fields, end: '', companyName: '', companyAddress: 'רחוב חברה 1' },
    }).success).toBe(true);
  });

  it.each(['declaration.html', 'declaration-en.html'])('shows optional company details on the first step in %s', async (filename) => {
    const page = await readFile(join(process.cwd(), 'public/forms', filename), 'utf8');
    expect(page).toMatch(/<input name="end" type="date">/);
    expect(page).toMatch(/<fieldset class="form-group company" id="company">/);
    expect(page).not.toMatch(/<details class="company"/);
    for (const field of ['companyName', 'companyNumber', 'companyAddress', 'companyPhone']) {
      expect(page).toContain(`name="${field}"`);
    }
  });
});
