import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRentalQuoteLinkToken,
  rentalQuotePdfPath,
  rentalQuoteShortLink,
  safeQuoteReference,
  verifyRentalQuoteLinkToken,
} from '@/lib/quote-link';

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
    const token = createRentalQuoteLinkToken('R912214', 'quote');
    const result = verifyRentalQuoteLinkToken(token);

    expect(result.valid).toBe(true);
    expect(result.quoteNumber).toBe('R912214');
    expect(result.mode).toBe('quote');

    const confirmation = verifyRentalQuoteLinkToken(
      createRentalQuoteLinkToken('R912214', 'confirmation')
    );
    expect(confirmation.valid).toBe(true);
    expect(confirmation.mode).toBe('confirmation');
  });

  it('stays short, URL-safe and branded', () => {
    const token = createRentalQuoteLinkToken('R912214', 'quote');
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
    const token = createRentalQuoteLinkToken('R912214', 'quote');
    const [, modeAndExpiry, signature] = token.split('-');
    const forged = `R000001-${modeAndExpiry}-${signature}`;

    const result = verifyRentalQuoteLinkToken(forged);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad-signature');
  });

  it('rejects a tampered document mode and a stretched expiry', () => {
    const token = createRentalQuoteLinkToken('R912214', 'quote');
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
    const token = createRentalQuoteLinkToken('R912214', 'quote');
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
    const expired = createRentalQuoteLinkToken('R912214', 'quote', -1);
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

    const response = await call(createRentalQuoteLinkToken('R912214', 'quote'));

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
      createRentalQuoteLinkToken('R912214', 'confirmation')
    );
    expect(response.headers.get('content-disposition')).toContain(
      'SmartCar_Booking_Confirmation_R912214.pdf'
    );
  });

  it('does not read storage for a forged link', async () => {
    const token = createRentalQuoteLinkToken('R912214', 'quote');
    const [reference, modeAndExpiry] = token.split('-');

    const response = await call(
      `${reference}-${modeAndExpiry}-bbbbbbbbbbbbbbbb`
    );
    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it('tells the customer an expired link expired', async () => {
    const response = await call(
      createRentalQuoteLinkToken('R912214', 'quote', -1)
    );
    expect(response.status).toBe(410);
    expect(await response.text()).toContain('פג תוקף');
    expect(download).not.toHaveBeenCalled();
  });

  it('handles a document that is no longer in the bucket', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const response = await call(createRentalQuoteLinkToken('R912214', 'quote'));
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).not.toContain('supabase');
  });
});
