import { describe, it, expect } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { scrubEvent, stripUrl } from '../sentry-scrub';

/**
 * These import the real scrubber the Sentry configs pass to beforeSend, so a
 * regression here fails the build instead of quietly shipping customer data
 * to a third party.
 */
describe('stripUrl', () => {
  it('drops the query string that the confirmation page puts in the URL', () => {
    expect(
      stripUrl(
        'https://www.smartcar.co.il/he/booking-confirmation?bookingId=8f2c1e44-1c0a-4c1e-9a11-2f7d5b6e0a33&vehicle=Toyota%20Aygo%20X&pickup=2026-08-01&return=2026-08-04',
      ),
    ).toBe('https://www.smartcar.co.il/he/booking-confirmation');
  });

  it('drops a raw address from the unsubscribe link', () => {
    expect(stripUrl('https://www.smartcar.co.il/api/newsletter/unsubscribe?email=a%40b.com')).toBe(
      'https://www.smartcar.co.il/api/newsletter/unsubscribe',
    );
  });

  it('drops the fragment as well as the query', () => {
    expect(stripUrl('https://www.smartcar.co.il/he/leasing?vehicle=abc#calculator')).toBe(
      'https://www.smartcar.co.il/he/leasing',
    );
  });

  it('handles a relative URL without throwing', () => {
    expect(stripUrl('/he/rental?pickup=2026-08-01')).toBe('https://www.smartcar.co.il/he/rental');
  });

  it('leaves a clean URL untouched', () => {
    expect(stripUrl('https://www.smartcar.co.il/en/about')).toBe(
      'https://www.smartcar.co.il/en/about',
    );
  });
});

describe('scrubEvent', () => {
  it('removes request query, body, cookies and sensitive headers', () => {
    const event = {
      request: {
        url: 'https://www.smartcar.co.il/he/booking-confirmation?bookingId=abc&email=a%40b.com',
        query_string: 'bookingId=abc&email=a%40b.com',
        data: { customerId: '312345678', phone: '0501234567' },
        cookies: { NEXT_LOCALE: 'he', admin_auth: 'signed-value' },
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'admin_auth=signed-value',
          Referer: 'https://www.smartcar.co.il/he/rental?email=a%40b.com',
          'X-Forwarded-For': '203.0.113.9',
        },
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.request?.url).toBe('https://www.smartcar.co.il/he/booking-confirmation');
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('rewrites navigation breadcrumbs, which carry the same URLs', () => {
    const event = {
      breadcrumbs: [
        {
          category: 'navigation',
          data: {
            from: '/he/rental?pickup=2026-08-01&email=a%40b.com',
            to: '/he/booking-confirmation?bookingId=abc',
          },
        },
        { category: 'fetch', data: { url: '/api/bookings?id=abc', status_code: 500 } },
        { category: 'ui.click', message: 'button' },
      ],
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.breadcrumbs?.[0].data).toEqual({
      from: 'https://www.smartcar.co.il/he/rental',
      to: 'https://www.smartcar.co.il/he/booking-confirmation',
    });
    expect(scrubbed.breadcrumbs?.[1].data).toEqual({
      url: 'https://www.smartcar.co.il/api/bookings',
      status_code: 500,
    });
    // A breadcrumb with no data survives untouched.
    expect(scrubbed.breadcrumbs?.[2].message).toBe('button');
  });

  it('does not throw on an event with no request or breadcrumbs', () => {
    expect(() => scrubEvent({} as ErrorEvent)).not.toThrow();
  });
});
