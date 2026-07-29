import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRentalQuoteLinkToken,
  rentalQuoteLinkExpiry,
  rentalQuotePdfPath,
  rentalQuoteShortLink,
  rentalQuoteValidityIsExpired,
  safeQuoteReference,
  verifyRentalQuoteLinkToken,
} from '@/lib/quote-link';

/** A month out, which is how long a rental quotation holds. */
const MONTH_AHEAD = Date.now() + 30 * 24 * 60 * 60 * 1000;
const mint = (
  quoteNumber: string,
  mode: 'quote' | 'confirmation',
  expiresAt: number = MONTH_AHEAD
) => createRentalQuoteLinkToken(quoteNumber, mode, expiresAt);

beforeAll(() => {
  process.env.QUOTE_LINK_SECRET = 'test-secret-for-quote-link-tests';
});

const download = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ download }) },
  }),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: vi.fn(async () => ({ success: true })),
}));

describe('rental quote link tokens', () => {
  it('round-trips a quote number and document mode', () => {
    const token = mint('R912214', 'quote');
    const result = verifyRentalQuoteLinkToken(token);

    expect(result.valid).toBe(true);
    expect(result.quoteNumber).toBe('R912214');
    expect(result.mode).toBe('quote');

    const confirmation = verifyRentalQuoteLinkToken(
      mint('R912214', 'confirmation')
    );
    expect(confirmation.valid).toBe(true);
    expect(confirmation.mode).toBe('confirmation');
  });

  it('stays short, URL-safe and branded', () => {
    const token = mint('R912214', 'quote');
    expect(token).toMatch(/^R912214-q[0-9a-z]+-[0-9a-z]{16}$/);
    expect(token.length).toBeLessThan(40);
    expect(rentalQuoteShortLink('https://smartcar.co.il', token)).toBe(
      `https://smartcar.co.il/q/${token}`
    );
    expect(rentalQuoteShortLink('https://smartcar.co.il/', token)).not.toContain(
      '//q/'
    );
  });

  it('rejects a tampered quote number', () => {
    const token = mint('R912214', 'quote');
    const [, modeAndExpiry, signature] = token.split('-');
    const forged = `R000001-${modeAndExpiry}-${signature}`;

    const result = verifyRentalQuoteLinkToken(forged);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad-signature');
  });

  it('rejects a tampered document mode and a stretched expiry', () => {
    const token = mint('R912214', 'quote');
    const [reference, modeAndExpiry, signature] = token.split('-');

    expect(
      verifyRentalQuoteLinkToken(
        `${reference}-c${modeAndExpiry.slice(1)}-${signature}`
      ).reason
    ).toBe('bad-signature');

    const later = (
      Number.parseInt(modeAndExpiry.slice(1), 36) + 60 * 24 * 30
    ).toString(36);
    expect(
      verifyRentalQuoteLinkToken(`${reference}-q${later}-${signature}`).reason
    ).toBe('bad-signature');
  });

  it('rejects a forged signature', () => {
    const token = mint('R912214', 'quote');
    const [reference, modeAndExpiry] = token.split('-');
    expect(
      verifyRentalQuoteLinkToken(
        `${reference}-${modeAndExpiry}-aaaaaaaaaaaaaaaa`
      ).reason
    ).toBe('bad-signature');
    // A truncated signature must not pass either.
    expect(
      verifyRentalQuoteLinkToken(`${reference}-${modeAndExpiry}-a`).reason
    ).toBe('bad-signature');
  });

  it('rejects an expired link even though the signature is intact', () => {
    const expired = mint('R912214', 'quote', Date.now() - 60_000);
    const result = verifyRentalQuoteLinkToken(expired);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('rejects malformed tokens without touching storage', () => {
    for (const token of [
      undefined,
      null,
      '',
      'R912214',
      'R912214-q1abc',
      'R912214-x1abc-aaaaaaaaaaaaaaaa',
      '../../secret',
      'R912214-q1abc-aaaa/bbbb',
      'R912214-q1abc-aaaaaaaaaaaaaaaa-extra',
    ]) {
      expect(verifyRentalQuoteLinkToken(token).valid).toBe(false);
    }
  });

  it('expires with the quotation, at the end of that day Israel time', () => {
    // 2026-08-29 is inside IDT (UTC+3), so the end of that day locally is
    // 20:59:59.999Z — a link opened on the 29th in Israel still works.
    const expiry = rentalQuoteLinkExpiry('2026-08-29');
    expect(new Date(expiry).toISOString()).toBe('2026-08-29T20:59:59.999Z');

    // And in winter (IST, UTC+2).
    expect(new Date(rentalQuoteLinkExpiry('2026-12-31')).toISOString()).toBe(
      '2026-12-31T21:59:59.999Z'
    );
  });

  it('keeps a link alive for the whole month a quotation holds', () => {
    const now = Date.parse('2026-07-30T09:00:00.000Z');
    const expiry = rentalQuoteLinkExpiry('2026-08-29', now);
    const days = (expiry - now) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29);

    const linkToken = mint('R912214', 'quote', expiry);
    expect(verifyRentalQuoteLinkToken(linkToken).valid).toBe(true);
  });

  it('falls back to 30 days when no validity date is given', () => {
    const now = Date.parse('2026-07-30T09:00:00.000Z');
    for (const missing of [undefined, null, '', 'not-a-date']) {
      const expiry = rentalQuoteLinkExpiry(missing, now);
      const days = (expiry - now) / (24 * 60 * 60 * 1000);
      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThan(31);
    }
  });

  it('does not quietly extend a validity date that has passed', () => {
    const now = Date.parse('2026-07-30T09:00:00.000Z');
    // Reported as expired instead of stretched to today: the send path refuses
    // it, so the date printed on the PDF stays true.
    expect(new Date(rentalQuoteLinkExpiry('2026-01-01', now)).toISOString()).toBe(
      '2026-01-01T21:59:59.999Z'
    );
    expect(rentalQuoteValidityIsExpired('2026-01-01', now)).toBe(true);
    expect(rentalQuoteValidityIsExpired('2026-08-29', now)).toBe(false);
    // Still valid for the whole of the current day in Israel.
    expect(rentalQuoteValidityIsExpired('2026-07-30', now)).toBe(false);
    // A missing date falls back to 30 days, which is never expired.
    expect(rentalQuoteValidityIsExpired('', now)).toBe(false);
  });

  it('derives a storage path that cannot escape the rental folder', () => {
    expect(rentalQuotePdfPath('R912214')).toBe('rental/R912214.pdf');
    expect(safeQuoteReference('../../etc/passwd')).toBe('etcpasswd');
    expect(rentalQuotePdfPath('../../etc/passwd')).toBe('rental/etcpasswd.pdf');
    expect(rentalQuotePdfPath('')).toBe('rental/quote.pdf');
  });
});

describe('GET /q/[token]', () => {
  beforeEach(() => {
    download.mockReset();
  });

  const call = async (token: string) => {
    const { GET } = await import('@/app/q/[token]/route');
    return GET(new Request(`https://smartcar.co.il/q/${token}`), {
      params: Promise.resolve({ token }),
    });
  };

  it('returns the PDF inline for a valid link', async () => {
    download.mockResolvedValue({
      data: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]),
      error: null,
    });

    const response = await call(mint('R912214', 'quote'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    const disposition = response.headers.get('content-disposition') ?? '';
    expect(disposition.startsWith('inline;')).toBe(true);
    expect(disposition).toContain('filename="SmartCar_Rental_Quote_R912214.pdf"');
    expect(disposition).toContain("filename*=UTF-8''");
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(download).toHaveBeenCalledWith('rental/R912214.pdf');
    expect(new Uint8Array(await response.arrayBuffer())[0]).toBe(0x25);
  });

  it('names a confirmation document as such', async () => {
    download.mockResolvedValue({ data: new Blob([new Uint8Array([1])]), error: null });
    const response = await call(
      mint('R912214', 'confirmation')
    );
    expect(response.headers.get('content-disposition')).toContain(
      'SmartCar_Booking_Confirmation_R912214.pdf'
    );
  });

  it('does not read storage for a forged link', async () => {
    const token = mint('R912214', 'quote');
    const [reference, modeAndExpiry] = token.split('-');

    const response = await call(
      `${reference}-${modeAndExpiry}-bbbbbbbbbbbbbbbb`
    );
    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it('tells the customer an expired link expired', async () => {
    const response = await call(
      mint('R912214', 'quote', Date.now() - 60_000)
    );
    expect(response.status).toBe(410);
    expect(await response.text()).toContain('פג תוקף');
    expect(download).not.toHaveBeenCalled();
  });

  it('handles a document that is no longer in the bucket', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const response = await call(mint('R912214', 'quote'));
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).not.toContain('supabase');
  });
});
