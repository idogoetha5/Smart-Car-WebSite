import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveQuotePdf } from '@/lib/quote-history';
import type { QuoteData } from '@/lib/quote-pdf';

/**
 * Covers the exact failure mode this system must never have again: two
 * distinct quotations silently merging into one row/PDF because they share
 * a customer email or a randomly-drawn six-digit display number. See the
 * docstring on insertOrUpdateQuote in src/lib/quote-history.ts.
 */

let table: Map<string, Record<string, unknown>>;
let uploadedPaths: string[];

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: async (path: string) => {
          uploadedPaths.push(path);
          return { error: null };
        },
      }),
    },
    from: (tableName: string) => {
      if (tableName !== 'quotes') throw new Error(`unexpected table ${tableName}`);
      return {
        select: () => ({
          eq: (_col: string, id: string) => ({
            maybeSingle: async () => ({ data: table.get(id) ?? null }),
          }),
        }),
        upsert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const id = payload.id as string;
              table.set(id, { ...table.get(id), ...payload });
              return { data: table.get(id), error: null };
            },
          }),
        }),
      };
    },
  }),
}));

function quote(overrides: Partial<QuoteData>): QuoteData {
  return {
    id: 'id-a',
    quoteNumber: '482913',
    date: '01.08.2026',
    customerName: 'ישראל ישראלי',
    customerEmail: 'same@customer.com',
    companyName: '',
    companyId: '',
    vehicles: [{
      name: 'Kia Sportage', subtitle: '', trim: '', year: '2026',
      listPrice: 0, downPayment: 0, monthlyPrice: 0, months: 0, annualKm: 0, imageUrl: '',
    }],
    ...overrides,
  };
}

beforeEach(() => {
  table = new Map();
  uploadedPaths = [];
});

describe('archiveQuotePdf collision safety', () => {
  it('never overwrites a different quote sharing the same customer email', async () => {
    const first = await archiveQuotePdf(quote({ id: 'quote-1', customerEmail: 'a@x.com' }), Buffer.from('pdf1'));
    const second = await archiveQuotePdf(quote({ id: 'quote-2', customerEmail: 'a@x.com' }), Buffer.from('pdf2'));

    expect(first.id).toBe('quote-1');
    expect(second.id).toBe('quote-2');
    expect(table.size).toBe(2);
    expect(table.get('quote-1')?.pdf_path).not.toBe(table.get('quote-2')?.pdf_path);
  });

  it('never overwrites two quotes that happen to draw the same six-digit display number', async () => {
    const first = await archiveQuotePdf(quote({ id: 'quote-A', quoteNumber: '111111', customerEmail: 'alice@x.com' }), Buffer.from('a'));
    const second = await archiveQuotePdf(quote({ id: 'quote-B', quoteNumber: '111111', customerEmail: 'bob@x.com' }), Buffer.from('b'));

    expect(table.size).toBe(2);
    expect(first.quote_number).toBe('111111');
    expect(second.quote_number).toBe('111111');
    expect(uploadedPaths).toHaveLength(2);
    expect(uploadedPaths[0]).not.toBe(uploadedPaths[1]);
  });

  it('simulates two parallel creations landing on the same random number without merging', async () => {
    const [a, b] = await Promise.all([
      archiveQuotePdf(quote({ id: 'parallel-1', quoteNumber: '555555', customerEmail: 'x@x.com' }), Buffer.from('a')),
      archiveQuotePdf(quote({ id: 'parallel-2', quoteNumber: '555555', customerEmail: 'y@y.com' }), Buffer.from('b')),
    ]);

    expect(a.id).not.toBe(b.id);
    expect(table.size).toBe(2);
  });

  it('re-saving the same session (same id, repeated "generate PDF" clicks) updates one row in place', async () => {
    await archiveQuotePdf(quote({ id: 'draft-1', customerName: 'First Name' }), Buffer.from('v1'));
    const updated = await archiveQuotePdf(quote({ id: 'draft-1', customerName: 'Edited Name' }), Buffer.from('v2'));

    expect(table.size).toBe(1);
    expect(updated.customer_name).toBe('Edited Name');
  });

  it("draws a fresh id if the supplied id somehow already belongs to a different customer's quote", async () => {
    table.set('reused-id', { id: 'reused-id', customer_email: 'existing-customer@x.com', status: 'saved' });

    const saved = await archiveQuotePdf(quote({ id: 'reused-id', customerEmail: 'new-customer@x.com' }), Buffer.from('pdf'));

    expect(saved.id).not.toBe('reused-id');
    expect(table.size).toBe(2);
    expect(table.get('reused-id')?.customer_email).toBe('existing-customer@x.com');
  });
});
